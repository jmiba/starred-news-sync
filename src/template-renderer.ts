import { App, normalizePath, TFile } from "obsidian";
import { IMPORT_HASH_FRONTMATTER_PROPERTY } from "./constants";
import { htmlToMarkdown } from "./utils/html-to-markdown";
import type { DebugViewMode, StarredNewsItem, StarredNewsSyncSettings } from "./types";

const TEMPLATER_PLUGIN_ID = "templater-obsidian";
const TEMPLATER_CREATE_NEW_RUN_MODE = 0;

interface TemplaterApi {
	create_running_config?: (templateFile: TFile | undefined, targetFile: TFile, runMode: number) => unknown;
	parse_template?: (config: unknown, templateContent: string) => Promise<string>;
}

interface AppWithPlugins extends App {
	plugins?: {
		getPlugin?: (id: string) => unknown;
		plugins?: Record<string, unknown>;
	};
}

interface TemplaterPluginShape {
	templater?: TemplaterApi;
}

export interface NoteTemplateContext {
	id: string;
	title: string;
	url: string;
	reader: string;
	rawApiItem?: unknown;
	author: string;
	feedTitle: string;
	feedUrl: string;
	publishedAt: string;
	updatedAt: string;
	contentHtml: string;
	summaryHtml: string;
	contentSource: string;
	contentFetchedAt: string;
	importedAt: string;
	tags: string[];
	notePath: string;
	fileName: string;
	shortHash: string;
	byline: string;
	selectedContentHtml: string;
	contentMarkdown: string;
	summaryMarkdown: string;
	content: {
		html: string;
		markdown: string;
		readerHtml: string;
		summaryHtml: string;
		summaryMarkdown: string;
		source: string;
		fetchedAt: string;
	};
	item: Record<string, string>;
	frontmatter: Record<string, string | string[]>;
}

export interface NoteIdentity {
	path: string;
	fileName: string;
	shortHash: string;
}

export function buildNoteTemplateContext(
	item: StarredNewsItem,
	settings: StarredNewsSyncSettings,
	identity: NoteIdentity,
	importedAt: string
): NoteTemplateContext {
	const tags = parseTags(settings.noteTags);
	const contentHtml = item.contentHtml || "";
	const summaryHtml = item.summaryHtml || "";
	const selectedContentHtml = settings.includeArticleContent ? contentHtml || summaryHtml : summaryHtml;
	const contentMarkdown = selectedContentHtml ? htmlToMarkdown(selectedContentHtml) : "";
	const summaryMarkdown = summaryHtml ? htmlToMarkdown(summaryHtml) : "";
	const byline = buildByline(item);
	const itemFields = {
		id: item.id,
		title: item.title,
		url: item.url,
		reader: item.reader,
		author: item.author || "",
		feedTitle: item.feedTitle || "",
		feedUrl: item.feedUrl || "",
		publishedAt: item.publishedAt || "",
		updatedAt: item.updatedAt || "",
		contentHtml,
		summaryHtml,
		contentSource: item.contentSource || "",
		contentFetchedAt: item.contentFetchedAt || "",
	};
	const frontmatter = buildFrontmatter(item, tags, importedAt, identity.shortHash);

	return {
		...itemFields,
		rawApiItem: item.rawApiItem,
		importedAt,
		tags,
		notePath: identity.path,
		fileName: identity.fileName,
		shortHash: identity.shortHash,
		byline,
		selectedContentHtml,
		contentMarkdown,
		summaryMarkdown,
		content: {
			html: selectedContentHtml,
			markdown: contentMarkdown,
			readerHtml: contentHtml,
			summaryHtml,
			summaryMarkdown,
			source: item.contentSource || "",
			fetchedAt: item.contentFetchedAt || "",
		},
		item: itemFields,
		frontmatter,
	};
}

export function formatDefaultNote(context: NoteTemplateContext): string {
	const lines = ["---"];

	for (const [key, value] of Object.entries(context.frontmatter)) {
		if (Array.isArray(value)) {
			if (value.length === 0) {
				continue;
			}

			lines.push(`${key}:`);

			for (const item of value) {
				lines.push(`  - ${yamlString(item)}`);
			}

			continue;
		}

		lines.push(`${key}: ${yamlString(value)}`);
	}

	lines.push("---", "", `# ${context.title || "Untitled RSS item"}`, "");

	if (context.url) {
		lines.push(`[Read original](${context.url})`, "");
	}

	if (context.byline) {
		lines.push(context.byline, "");
	}

	if (context.contentMarkdown) {
		lines.push(context.contentMarkdown, "");
	} else {
		lines.push("No article content was returned by the reader API.", "");
	}

	return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function appendDebugView(
	markdown: string,
	context: NoteTemplateContext,
	settings: StarredNewsSyncSettings
): string {
	if (!settings.includeDebugView) {
		return markdown;
	}

	const debugBlock = formatDebugBlock(context, settings.debugViewMode);
	const trimmed = markdown.replace(/\s+$/u, "");

	return `${trimmed}\n\n${debugBlock}\n`;
}

export function ensureImportHashFrontmatter(markdown: string, shortHash: string): string {
	const hashLine = `${IMPORT_HASH_FRONTMATTER_PROPERTY}: ${yamlString(shortHash)}`;
	const lines = markdown.split(/\r?\n/);

	if (lines[0] === "---") {
		const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

		if (closingIndex > 0) {
			const frontmatterLines = lines.slice(1, closingIndex);

			if (frontmatterLines.some((line) => line.match(new RegExp(`^\\s*${IMPORT_HASH_FRONTMATTER_PROPERTY}\\s*:`)))) {
				return markdown;
			}

			return [...lines.slice(0, closingIndex), hashLine, ...lines.slice(closingIndex)].join("\n");
		}
	}

	return ["---", hashLine, "---", "", markdown].join("\n");
}

export async function renderNoteTemplate(
	app: App,
	templateFile: TFile,
	targetFile: TFile,
	context: NoteTemplateContext
): Promise<string> {
	const templateContent = await app.vault.read(templateFile);
	const templater = getTemplater(app);

	if (!templater?.parse_template) {
		console.warn("Templater is not available. Rendering note template with Starred News Sync placeholders only.");
		return replaceStarredNewsPlaceholders(templateContent, context);
	}

	const config = templater.create_running_config
		? templater.create_running_config(templateFile, targetFile, TEMPLATER_CREATE_NEW_RUN_MODE)
		: {
				template_file: templateFile,
				target_file: targetFile,
				run_mode: TEMPLATER_CREATE_NEW_RUN_MODE,
				active_file: null,
			};
	const templaterContent = `${buildTemplaterContextPrelude(context)}${templateContent}`;
	const rendered = await templater.parse_template(config, templaterContent);

	return replaceStarredNewsPlaceholders(rendered, context);
}

export function resolveTemplateFile(app: App, rawPath: string): TFile | null {
	const path = cleanTemplatePath(rawPath);

	if (!path) {
		return null;
	}

	for (const candidate of getTemplatePathCandidates(path)) {
		const file = app.vault.getAbstractFileByPath(candidate);

		if (file instanceof TFile) {
			return file;
		}
	}

	const linkTarget = app.metadataCache.getFirstLinkpathDest(path.replace(/\.md$/i, ""), "");

	return linkTarget instanceof TFile ? linkTarget : null;
}

function buildFrontmatter(
	item: StarredNewsItem,
	tags: string[],
	importedAt: string,
	shortHash: string
): Record<string, string | string[]> {
	const frontmatter: Record<string, string | string[]> = {
		title: item.title,
		url: item.url,
		reader: item.reader,
		reader_item_id: item.id,
		imported: importedAt,
		[IMPORT_HASH_FRONTMATTER_PROPERTY]: shortHash,
	};

	appendFrontmatterValue(frontmatter, "author", item.author);
	appendFrontmatterValue(frontmatter, "feed", item.feedTitle);
	appendFrontmatterValue(frontmatter, "feed_url", item.feedUrl);
	appendFrontmatterValue(frontmatter, "published", item.publishedAt);
	appendFrontmatterValue(frontmatter, "updated", item.updatedAt);
	appendFrontmatterValue(frontmatter, "content_source", item.contentSource);
	appendFrontmatterValue(frontmatter, "content_fetched_at", item.contentFetchedAt);

	if (tags.length > 0) {
		frontmatter.tags = tags;
	}

	return frontmatter;
}

function appendFrontmatterValue(
	frontmatter: Record<string, string | string[]>,
	key: string,
	value: string | undefined
): void {
	if (value) {
		frontmatter[key] = value;
	}
}

function buildTemplaterContextPrelude(context: NoteTemplateContext): string {
	const serializedContext = JSON.stringify(JSON.stringify(context));

	return `<%*\nconst rss = JSON.parse(${serializedContext});\nconst item = rss.item;\nconst content = rss.content;\n-%>\n`;
}

function replaceStarredNewsPlaceholders(template: string, context: NoteTemplateContext): string {
	return template.replace(/\{\{\s*(?:rss\.)?([A-Za-z0-9_.]+)\s*\}\}/g, (match, path: string) => {
		const value = getPath(context, path);

		if (value === undefined || value === null) {
			return match;
		}

		return formatTemplateValue(value);
	});
}

function getPath(value: unknown, path: string): unknown {
	return path.split(".").reduce<unknown>((current, key) => {
		if (current && typeof current === "object" && key in current) {
			return (current as Record<string, unknown>)[key];
		}

		return undefined;
	}, value);
}

function formatTemplateValue(value: unknown): string {
	if (Array.isArray(value)) {
		return value.join(", ");
	}

	if (typeof value === "object") {
		return JSON.stringify(value, null, 2);
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return value.toString();
	}

	return "";
}

function getTemplater(app: App): TemplaterApi | null {
	const plugins = (app as AppWithPlugins).plugins;
	const plugin =
		plugins?.getPlugin?.(TEMPLATER_PLUGIN_ID) || plugins?.plugins?.[TEMPLATER_PLUGIN_ID];
	const templater = (plugin as TemplaterPluginShape | undefined)?.templater;

	return templater?.parse_template ? templater : null;
}

function getTemplatePathCandidates(path: string): string[] {
	const normalized = normalizePath(path);
	const candidates = [normalized];

	if (!normalized.toLowerCase().endsWith(".md")) {
		candidates.push(`${normalized}.md`);
	}

	return candidates;
}

function cleanTemplatePath(value: string): string {
	const trimmed = value.trim();
	const wikilinkMatch = trimmed.match(/^\[\[([^#|\]]+)(?:[#|][^\]]*)?\]\]$/);

	return wikilinkMatch?.[1]?.trim() || trimmed;
}

function buildByline(item: StarredNewsItem): string {
	const parts = [item.feedTitle, item.author, item.publishedAt?.slice(0, 10)].filter(
		(value): value is string => Boolean(value)
	);

	return parts.join(" | ");
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

function formatDebugBlock(context: NoteTemplateContext, mode: DebugViewMode): string {
	const title =
		mode === "json"
			? "Imported item debug JSON"
			: mode === "raw-json"
				? "Imported item raw API JSON"
				: "Imported item debug fields";
	const body =
		mode === "json"
			? formatDebugJson(context.item)
			: mode === "raw-json"
				? formatDebugJson(context.rawApiItem ?? { unavailable: "Raw API item was not captured for this import." })
				: formatDebugFields(context.item);

	return [`> [!info]- ${title}`, ...prefixCalloutLines(body)].join("\n");
}

function formatDebugJson(value: unknown): string {
	return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function formatDebugFields(item: Record<string, string>): string {
	const lines = Object.entries(item).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

	return ["```text", ...lines, "```"].join("\n");
}

function prefixCalloutLines(content: string): string[] {
	return content.split("\n").map((line) => (line ? `> ${line}` : ">"));
}
