import { App, normalizePath, TFile } from "obsidian";
import { DuplicateHashIndex } from "./duplicate-hash-index";
import { DuplicateUrlIndex } from "./duplicate-url-index";
import { logDebug } from "./debug-log";
import {
	buildNoteTemplateContext,
	appendDebugView,
	ensureImportHashFrontmatter,
	formatDefaultNote,
	renderNoteTemplate,
	resolveTemplateFile,
	type NoteIdentity,
} from "./template-renderer";
import type { StarredNewsItem, StarredNewsSyncSettings, SyncResult } from "./types";

interface NoteWriterOptions {
	beforeWrite?: (item: StarredNewsItem) => Promise<StarredNewsItem>;
}

export class NoteWriter {
	constructor(private readonly app: App) {}

	async writeItems(
		items: StarredNewsItem[],
		settings: StarredNewsSyncSettings,
		options: NoteWriterOptions = {}
	): Promise<SyncResult> {
		const outputFolder = settings.outputFolder.trim() ? normalizePath(settings.outputFolder.trim()) : "";
		const templatePath = settings.noteTemplatePath.trim();
		const templateFile = templatePath ? resolveTemplateFile(this.app, templatePath) : null;
		const duplicateHashIndex = await DuplicateHashIndex.fromOutputFolder(this.app, outputFolder);
		const duplicateUrlIndex = DuplicateUrlIndex.fromSettings(this.app, settings);
		const createdPaths: string[] = [];
		let imported = 0;
		let skipped = 0;

		if (templatePath && !templateFile) {
			throw new Error(`Note template was not found: ${templatePath}`);
		}

		if (outputFolder) {
			await this.ensureFolder(outputFolder);
		}

		for (const item of items) {
			const identity = this.buildNoteIdentity(item, outputFolder);

			if (duplicateHashIndex.has(identity.shortHash) || (await this.app.vault.adapter.exists(identity.path))) {
				logDebug(settings, item, "Import skipped before article fetch because the note already exists.", {
					path: identity.path,
					shortHash: identity.shortHash,
				});
				duplicateHashIndex.add(identity.shortHash);
				duplicateUrlIndex?.add(item.url);
				skipped++;
				continue;
			}

			if (duplicateUrlIndex?.has(item.url)) {
				logDebug(settings, item, "Import skipped before article fetch because the URL matched an existing note.", {
					path: identity.path,
				});
				skipped++;
				continue;
			}

			const itemToWrite = options.beforeWrite ? await options.beforeWrite(item) : item;
			const importedAt = new Date().toISOString();
			const context = buildNoteTemplateContext(itemToWrite, settings, identity, importedAt);
			const defaultNote = appendDebugView(formatDefaultNote(context), context, settings);

			if (templateFile) {
				const targetFile = await this.app.vault.create(identity.path, defaultNote);

				try {
					const renderedNote = appendDebugView(
						ensureImportHashFrontmatter(
							await renderNoteTemplate(this.app, templateFile, targetFile, context),
							identity.shortHash
						),
						context,
						settings
					);
					await this.app.vault.modify(targetFile, renderedNote);
				} catch (error) {
					await this.trashPartialNote(targetFile);
					throw error;
				}
			} else {
				await this.app.vault.create(identity.path, defaultNote);
			}

			createdPaths.push(identity.path);
			duplicateHashIndex.add(identity.shortHash);
			duplicateUrlIndex?.add(itemToWrite.url);
			imported++;
		}

		return {
			fetched: items.length,
			imported,
			skipped,
			createdPaths,
		};
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		const parts = folderPath.split("/").filter(Boolean);
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;

			if (!(await this.app.vault.adapter.exists(currentPath))) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}

	private buildNoteIdentity(item: StarredNewsItem, outputFolder: string): NoteIdentity {
		const hash = shortHash(item.url || item.id).slice(0, 8);
		const title = sanitizeObsidianFileName(item.title || item.url || item.id);
		const fileName = `${title} - RSS ${hash}.md`;

		return {
			path: outputFolder ? `${outputFolder}/${fileName}` : fileName,
			fileName,
			shortHash: hash,
		};
	}

	private async trashPartialNote(file: TFile): Promise<void> {
		try {
			await this.app.fileManager.trashFile(file);
		} catch (error) {
			console.warn("Starred News Sync could not remove a partially rendered note.", error);
		}
	}
}

function sanitizeObsidianFileName(value: string): string {
	const sanitized = replaceControlCharacters(value)
		.replace(/[\\/:*?"<>|]/g, " ")
		.replace(/\s+/g, " ")
		.replace(/^\.+/, "")
		.trim()
		.slice(0, 180)
		.trim()
		.replace(/[. ]+$/, "");

	return sanitized || "Untitled RSS item";
}

function replaceControlCharacters(value: string): string {
	return Array.from(value)
		.map((character) => {
			const codePoint = character.codePointAt(0);

			if (codePoint === undefined || codePoint < 32 || codePoint === 127) {
				return " ";
			}

			return character;
		})
		.join("");
}

function shortHash(value: string): string {
	let hash = 0x811c9dc5;

	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}

	return hash.toString(36);
}
