import { App, normalizePath } from "obsidian";
import { htmlToMarkdown } from "./utils/html-to-markdown";
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
		const createdPaths: string[] = [];
		let imported = 0;
		let skipped = 0;

		if (outputFolder) {
			await this.ensureFolder(outputFolder);
		}

		for (const item of items) {
			const path = this.buildNotePath(item, outputFolder);

			if (await this.app.vault.adapter.exists(path)) {
				skipped++;
				continue;
			}

			const itemToWrite = options.beforeWrite ? await options.beforeWrite(item) : item;
			await this.app.vault.create(path, formatNote(itemToWrite, settings));
			createdPaths.push(path);
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

	private buildNotePath(item: StarredNewsItem, outputFolder: string): string {
		const hash = shortHash(item.url || item.id).slice(0, 8);
		const title = sanitizeObsidianFileName(item.title || item.url || item.id);
		const filename = `${title} - RSS ${hash}.md`;

		return outputFolder ? `${outputFolder}/${filename}` : filename;
	}
}

function formatNote(item: StarredNewsItem, settings: StarredNewsSyncSettings): string {
	const importedAt = new Date().toISOString();
	const tags = parseTags(settings.noteTags);
	const lines = [
		"---",
		`title: ${yamlString(item.title)}`,
		`url: ${yamlString(item.url)}`,
		`reader: ${yamlString(item.reader)}`,
		`reader_item_id: ${yamlString(item.id)}`,
		`imported: ${yamlString(importedAt)}`,
	];

	appendYamlValue(lines, "author", item.author);
	appendYamlValue(lines, "feed", item.feedTitle);
	appendYamlValue(lines, "feed_url", item.feedUrl);
	appendYamlValue(lines, "published", item.publishedAt);
	appendYamlValue(lines, "updated", item.updatedAt);
	appendYamlValue(lines, "content_source", item.contentSource);
	appendYamlValue(lines, "content_fetched_at", item.contentFetchedAt);

	if (tags.length > 0) {
		lines.push("tags:");

		for (const tag of tags) {
			lines.push(`  - ${yamlString(tag)}`);
		}
	}

	lines.push("---", "", `# ${item.title || "Untitled RSS item"}`, "");

	if (item.url) {
		lines.push(`[Read original](${item.url})`, "");
	}

	const byline = buildByline(item);

	if (byline) {
		lines.push(byline, "");
	}

	const html = settings.includeArticleContent ? item.contentHtml || item.summaryHtml : item.summaryHtml;
	const markdown = html ? htmlToMarkdown(html) : "";

	if (markdown) {
		lines.push(markdown, "");
	} else {
		lines.push("No article content was returned by the reader API.", "");
	}

	return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function buildByline(item: StarredNewsItem): string {
	const parts = [item.feedTitle, item.author, item.publishedAt?.slice(0, 10)].filter(
		(value): value is string => Boolean(value)
	);

	return parts.join(" | ");
}

function appendYamlValue(lines: string[], key: string, value: string | undefined): void {
	if (!value) {
		return;
	}

	lines.push(`${key}: ${yamlString(value)}`);
}

function yamlString(value: string): string {
	return JSON.stringify(value);
}

function parseTags(value: string): string[] {
	const seen = new Set<string>();
	const tags: string[] = [];

	for (const rawTag of value.split(/[,\n]/)) {
		const tag = rawTag.trim().replace(/^#/, "");

		if (tag && !seen.has(tag)) {
			seen.add(tag);
			tags.push(tag);
		}
	}

	return tags;
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
