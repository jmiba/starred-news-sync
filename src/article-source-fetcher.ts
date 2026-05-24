import Defuddle from "defuddle";
import { requestUrl } from "obsidian";
import type { StarredNewsItem, StarredNewsSyncSettings } from "./types";

const MAX_ARTICLE_BYTES = 2_000_000;
const ARTICLE_REQUEST_HEADERS = {
	Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1",
};

interface ExtractedArticle {
	html: string;
	fetchedAt: string;
}

interface ExtractReadableHtmlOptions {
	includeRemoteImages: boolean;
}

export class ArticleSourceFetcher {
	constructor(private readonly settings: StarredNewsSyncSettings) {}

	async enrichItem(item: StarredNewsItem): Promise<StarredNewsItem> {
		if (!this.shouldFetch(item)) {
			return item;
		}

		try {
			const article = await this.fetchArticle(item.url);

			if (!article) {
				return item;
			}

			return {
				...item,
				contentHtml: article.html,
				contentSource: "article_url",
				contentFetchedAt: article.fetchedAt,
			};
		} catch (error) {
			console.warn(`Unable to fetch article source for ${item.url}`, error);
			return item;
		}
	}

	private shouldFetch(item: StarredNewsItem): boolean {
		if (!this.settings.includeArticleContent || !this.settings.fetchArticleSource || !item.url) {
			return false;
		}

		if (this.settings.articleSourceMode === "always") {
			return true;
		}

		return !item.contentHtml;
	}

	private async fetchArticle(url: string): Promise<ExtractedArticle | null> {
		const safeUrl = parseSafeArticleUrl(url);

		if (!safeUrl) {
			return null;
		}

		await this.verifyContentLength(safeUrl);

		const response = await requestUrl({
			url: safeUrl,
			method: "GET",
			headers: ARTICLE_REQUEST_HEADERS,
			throw: false,
		});

		if (response.status < 200 || response.status >= 300) {
			return null;
		}

		if (response.arrayBuffer.byteLength > MAX_ARTICLE_BYTES) {
			return null;
		}

		if (!isSupportedContentType(getHeader(response.headers, "content-type"))) {
			return null;
		}

		const html = extractReadableHtml(response.text, safeUrl, {
			includeRemoteImages: this.settings.includeRemoteImages,
		});

		if (!html) {
			return null;
		}

		return {
			html,
			fetchedAt: new Date().toISOString(),
		};
	}

	private async verifyContentLength(url: string): Promise<void> {
		try {
			const response = await requestUrl({
				url,
				method: "HEAD",
				headers: ARTICLE_REQUEST_HEADERS,
				throw: false,
			});
			const contentLength = Number.parseInt(getHeader(response.headers, "content-length") || "", 10);

			if (Number.isFinite(contentLength) && contentLength > MAX_ARTICLE_BYTES) {
				throw new Error("Article source is larger than the configured safety limit.");
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes("safety limit")) {
				throw error;
			}
		}
	}
}

function parseSafeArticleUrl(value: string): string | null {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") {
		return null;
	}

	if (isBlockedHost(url.hostname)) {
		return null;
	}

	return url.toString();
}

function isBlockedHost(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

	if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
		return true;
	}

	if (isBlockedIpv4(host) || isBlockedIpv6(host)) {
		return true;
	}

	return !host.includes(".");
}

function isBlockedIpv4(host: string): boolean {
	const parts = host.split(".");

	if (parts.length !== 4) {
		return false;
	}

	if (!parts.every((part) => /^\d+$/.test(part))) {
		return false;
	}

	const octets = parts.map((part) => Number.parseInt(part, 10));

	if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
		return false;
	}

	const first = octets[0]!;
	const second = octets[1]!;

	return (
		first === 0 ||
		first === 10 ||
		first === 127 ||
		first >= 224 ||
		(first === 100 && second >= 64 && second <= 127) ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168) ||
		(first === 198 && (second === 18 || second === 19))
	);
}

function isBlockedIpv6(host: string): boolean {
	if (!host.includes(":")) {
		return false;
	}

	return (
		host === "::" ||
		host === "::1" ||
		host.startsWith("fc") ||
		host.startsWith("fd") ||
		host.startsWith("fe8") ||
		host.startsWith("fe9") ||
		host.startsWith("fea") ||
		host.startsWith("feb")
	);
}

function isSupportedContentType(contentType: string | undefined): boolean {
	if (!contentType) {
		return true;
	}

	const normalized = contentType.toLowerCase();

	return (
		normalized.includes("text/html") ||
		normalized.includes("application/xhtml+xml") ||
		normalized.includes("text/plain")
	);
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
	const normalizedName = name.toLowerCase();
	const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === normalizedName);

	return entry?.[1];
}

function extractReadableHtml(source: string, url: string, options: ExtractReadableHtmlOptions): string {
	if (!source.trim()) {
		return "";
	}

	if (typeof DOMParser === "undefined") {
		return escapeHtml(source);
	}

	const document = new DOMParser().parseFromString(source, "text/html");
	const result = new Defuddle(document, {
		includeReplies: false,
		removeImages: !options.includeRemoteImages,
		url,
		useAsync: false,
	}).parse();
	const html = result.content || textToHtml(result.description || document.body.textContent || "");

	if (!html.trim()) {
		return "";
	}

	const outputDocument = new DOMParser().parseFromString(html, "text/html");
	sanitizeDocument(outputDocument, url, options);
	return outputDocument.body.innerHTML;
}

function sanitizeDocument(document: Document, url: string, options: ExtractReadableHtmlOptions): void {
	const removableMedia = options.includeRemoteImages ? "source, svg" : "img, picture, source, svg";

	for (const element of Array.from(
		document.querySelectorAll(
			`script, style, iframe, object, embed, form, input, button, nav, aside, header, footer, ${removableMedia}`
		)
	)) {
		element.remove();
	}

	for (const element of Array.from(
		document.querySelectorAll(
			".ad, .ads, .advertisement, .banner, .cookie, .comments, .newsletter, .promo, .related, .share, .sidebar, [aria-hidden='true']"
		)
	)) {
		element.remove();
	}

	for (const element of Array.from(document.querySelectorAll("*"))) {
		for (const attribute of Array.from(element.attributes)) {
			const name = attribute.name.toLowerCase();
			const value = attribute.value;

			if (name.startsWith("on") || name === "style") {
				element.removeAttribute(attribute.name);
				continue;
			}

			if (name === "srcset" || name === "sizes") {
				element.removeAttribute(attribute.name);
				continue;
			}

			if (name === "href" || name === "src") {
				const safeUrl = resolveSafeRemoteUrl(value, url);

				if (safeUrl) {
					element.setAttribute(attribute.name, safeUrl);
				} else {
					element.removeAttribute(attribute.name);
				}
			}
		}

		if (element.tagName.toLowerCase() === "img" && !element.getAttribute("src")) {
			element.remove();
		}
	}
}

function resolveSafeRemoteUrl(value: string, baseUrl: string): string | null {
	try {
		const url = new URL(value, baseUrl);

		if ((url.protocol === "https:" || url.protocol === "http:") && !isBlockedHost(url.hostname)) {
			return url.toString();
		}
	} catch {
		return null;
	}

	return null;
}

function textToHtml(text: string): string {
	return text
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
		.join("");
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
