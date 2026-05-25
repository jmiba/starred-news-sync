import { normalizePath, TFile, TFolder, type App } from "obsidian";
import type { StarredNewsSyncSettings } from "./types";

type FrontmatterRecord = Record<string, unknown>;

export class DuplicateUrlIndex {
	private readonly urls = new Set<string>();

	private constructor(
		private readonly app: App,
		private readonly frontmatterProperties: string[],
		private readonly outputFolder: string
	) {
		this.build();
	}

	static fromSettings(app: App, settings: StarredNewsSyncSettings): DuplicateUrlIndex | null {
		if (!settings.detectDuplicateUrls) {
			return null;
		}

		const frontmatterProperties = parseFrontmatterProperties(settings.duplicateUrlFrontmatterProperty);

		if (frontmatterProperties.length === 0) {
			return null;
		}

		const outputFolder = settings.outputFolder.trim() ? normalizePath(settings.outputFolder.trim()) : "";

		if (!outputFolder) {
			return null;
		}

		return new DuplicateUrlIndex(app, frontmatterProperties, outputFolder);
	}

	has(url: string): boolean {
		const normalizedUrl = normalizeDuplicateUrl(url);

		return normalizedUrl ? this.urls.has(normalizedUrl) : false;
	}

	add(url: string): void {
		const normalizedUrl = normalizeDuplicateUrl(url);

		if (normalizedUrl) {
			this.urls.add(normalizedUrl);
		}
	}

	private build(): void {
		const folder = this.app.vault.getAbstractFileByPath(this.outputFolder);

		if (folder instanceof TFolder) {
			this.indexFolder(folder);
		}
	}

	private indexFolder(folder: TFolder): void {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				this.indexFolder(child);
			} else if (child instanceof TFile && child.extension.toLowerCase() === "md") {
				this.indexFile(child);
			}
		}
	}

	private indexFile(file: TFile): void {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

		if (!isFrontmatterRecord(frontmatter)) {
			return;
		}

		for (const property of this.frontmatterProperties) {
			for (const value of collectStringValues(readFrontmatterValue(frontmatter, property))) {
				this.add(value);
			}
		}
	}
}

function parseFrontmatterProperties(value: string): string[] {
	const seen = new Set<string>();
	const properties: string[] = [];

	for (const rawProperty of value.split(/[,\n]/)) {
		const property = rawProperty.trim();

		if (property && !seen.has(property)) {
			seen.add(property);
			properties.push(property);
		}
	}

	return properties;
}

function readFrontmatterValue(frontmatter: FrontmatterRecord, property: string): unknown {
	if (Object.prototype.hasOwnProperty.call(frontmatter, property)) {
		return frontmatter[property];
	}

	return property.split(".").reduce<unknown>((current, key) => {
		if (isFrontmatterRecord(current) && Object.prototype.hasOwnProperty.call(current, key)) {
			return current[key];
		}

		return undefined;
	}, frontmatter);
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

function normalizeDuplicateUrl(value: string): string | null {
	const trimmed = value.trim();

	if (!trimmed) {
		return null;
	}

	try {
		const url = new URL(trimmed);

		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return trimmed;
		}

		url.hash = "";
		url.hostname = url.hostname.toLowerCase();

		if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
			url.port = "";
		}

		if (url.pathname !== "/") {
			url.pathname = url.pathname.replace(/\/+$/, "") || "/";
		}

		return url.toString();
	} catch {
		return trimmed.replace(/#.*$/, "").replace(/\/+$/, "") || trimmed;
	}
}
