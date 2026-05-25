import { normalizePath, TFile, TFolder, type App } from "obsidian";
import { IMPORT_HASH_FRONTMATTER_PROPERTY } from "./constants";

type FrontmatterRecord = Record<string, unknown>;

const RSS_HASH_FILENAME_PATTERN = / - RSS ([a-z0-9]{1,8})\.md$/i;

export class DuplicateHashIndex {
	private readonly hashes = new Set<string>();

	private constructor(private readonly app: App) {}

	static async fromOutputFolder(app: App, outputFolder: string): Promise<DuplicateHashIndex> {
		const index = new DuplicateHashIndex(app);
		await index.build(outputFolder.trim() ? normalizePath(outputFolder.trim()) : "");
		return index;
	}

	has(hash: string): boolean {
		const normalizedHash = normalizeHash(hash);

		return normalizedHash ? this.hashes.has(normalizedHash) : false;
	}

	add(hash: string): void {
		const normalizedHash = normalizeHash(hash);

		if (normalizedHash) {
			this.hashes.add(normalizedHash);
		}
	}

	private async build(outputFolder: string): Promise<void> {
		const folder = outputFolder ? this.app.vault.getAbstractFileByPath(outputFolder) : this.app.vault.getRoot();

		if (folder instanceof TFolder) {
			await this.indexFolder(folder);
		}
	}

	private async indexFolder(folder: TFolder): Promise<void> {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				await this.indexFolder(child);
			} else if (child instanceof TFile && child.extension.toLowerCase() === "md") {
				await this.indexFile(child);
			}
		}
	}

	private async indexFile(file: TFile): Promise<void> {
		const fileNameHash = getHashFromFileName(file.name);

		if (fileNameHash) {
			this.add(fileNameHash);
		}

		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		const cachedHashes = isFrontmatterRecord(frontmatter)
			? collectStringValues(frontmatter[IMPORT_HASH_FRONTMATTER_PROPERTY])
			: [];

		if (cachedHashes.length > 0) {
			for (const hash of cachedHashes) {
				this.add(hash);
			}
			return;
		}

		if (frontmatter !== undefined) {
			return;
		}

		try {
			const content = await this.app.vault.cachedRead(file);

			for (const hash of getHashesFromMarkdownFrontmatter(content)) {
				this.add(hash);
			}
		} catch (error) {
			console.warn(`Starred News Sync could not scan duplicate hash metadata for ${file.path}.`, error);
		}
	}
}

function getHashFromFileName(fileName: string): string | null {
	return normalizeHash(fileName.match(RSS_HASH_FILENAME_PATTERN)?.[1] || "");
}

function getHashesFromMarkdownFrontmatter(markdown: string): string[] {
	const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

	if (!frontmatterMatch?.[1]) {
		return [];
	}

	const lines = frontmatterMatch[1].split(/\r?\n/);
	const hashes: string[] = [];

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!;
		const propertyMatch = line.match(new RegExp(`^\\s*${IMPORT_HASH_FRONTMATTER_PROPERTY}\\s*:\\s*(.*)$`));

		if (!propertyMatch) {
			continue;
		}

		const inlineValue = propertyMatch[1]?.trim() || "";

		if (inlineValue) {
			hashes.push(...extractHashesFromScalar(inlineValue));
			continue;
		}

		for (let childIndex = index + 1; childIndex < lines.length; childIndex++) {
			const childLine = lines[childIndex]!;

			if (!/^\s+-\s+/.test(childLine)) {
				break;
			}

			hashes.push(...extractHashesFromScalar(childLine.replace(/^\s+-\s+/, "")));
		}
	}

	return hashes;
}

function extractHashesFromScalar(value: string): string[] {
	const withoutComment = value.replace(/\s+#.*$/, "").trim();

	if (withoutComment.startsWith("[") && withoutComment.endsWith("]")) {
		return (
			withoutComment
				.match(/[a-z0-9]+/gi)
				?.map((hash) => normalizeHash(hash))
				.filter((hash): hash is string => Boolean(hash)) || []
		);
	}

	const scalarMatch = withoutComment.match(/^["']?([a-z0-9]+)["']?$/i);
	const hash = normalizeHash(scalarMatch?.[1] || "");

	return hash ? [hash] : [];
}

function collectStringValues(value: unknown): string[] {
	if (typeof value === "string") {
		return [value];
	}

	if (Array.isArray(value)) {
		return value.flatMap((entry) => collectStringValues(entry));
	}

	return [];
}

function isFrontmatterRecord(value: unknown): value is FrontmatterRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeHash(hash: string): string | null {
	const normalized = hash.trim().toLowerCase();

	return /^[a-z0-9]+$/.test(normalized) ? normalized : null;
}
