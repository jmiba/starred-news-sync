import { requestUrl } from "obsidian";
import Defuddle from "defuddle";
import { logDebug } from "./debug-log";
import type { StarredNewsItem, StarredNewsSyncSettings } from "./types";

const MAX_ARTICLE_BYTES = 2_000_000;
const ARTICLE_REQUEST_TIMEOUT_MS = 20_000;
const ARTICLE_REQUEST_HEADERS: Record<string, string> = {
	Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1",
};

interface ExtractedArticle {
	html: string;
	fetchedAt: string;
}

interface ArticleSourceResponse {
	text: string;
	url: string;
}

interface ExtractReadableHtmlOptions {
	includeRemoteImages: boolean;
}

type ArticleFetchDecision =
	| { shouldFetch: true; reason: string }
	| { shouldFetch: false; reason: string };

type ArticleFetchResult =
	| { ok: true; article: ExtractedArticle }
	| { ok: false; reason: string };

type ArticleSourceResponseResult =
	| { ok: true; response: ArticleSourceResponse }
	| { ok: false; reason: string };

export class ArticleSourceFetcher {
	constructor(private readonly settings: StarredNewsSyncSettings) {}

	async enrichItem(item: StarredNewsItem): Promise<StarredNewsItem> {
		const decision = this.getFetchDecision(item);

		if (!decision.shouldFetch) {
			logDebug(this.settings, item, `Article fetch skipped: ${decision.reason}`);
			return item;
		}

		logDebug(this.settings, item, `Article fetch started: ${decision.reason}`);

		try {
			const result = await this.fetchArticle(item.url);

			if (!result.ok) {
				logDebug(this.settings, item, `Article fetch failed: ${result.reason}`);
				return item;
			}

			const article = result.article;
			logDebug(this.settings, item, "Article fetch succeeded.", {
				contentLength: article.html.length,
				fetchedAt: article.fetchedAt,
			});

			return {
				...item,
				contentHtml: article.html,
				contentSource: "article_url",
				contentFetchedAt: article.fetchedAt,
			};
		} catch (error) {
			logDebug(this.settings, item, "Article fetch failed with an unexpected error.", {
				error: error instanceof Error ? error.message : String(error),
			});
			console.warn(`Unable to fetch article source for ${item.url}`, error);
			return item;
		}
	}

	private getFetchDecision(item: StarredNewsItem): ArticleFetchDecision {
		if (!this.settings.includeArticleContent || !this.settings.fetchArticleSource || !item.url) {
			if (!this.settings.includeArticleContent) {
				return { shouldFetch: false, reason: "include article content is disabled" };
			}

			if (!this.settings.fetchArticleSource) {
				return { shouldFetch: false, reason: "fetch article source text is disabled" };
			}

			return { shouldFetch: false, reason: "item URL is empty" };
		}

		if (this.settings.articleSourceMode === "always") {
			return { shouldFetch: true, reason: "source fetch mode is always" };
		}

		if (hasMeaningfulContent(item.contentHtml)) {
			return { shouldFetch: false, reason: "reader content is already present" };
		}

		return { shouldFetch: true, reason: "reader content is missing or blank" };
	}

	private async fetchArticle(url: string): Promise<ArticleFetchResult> {
		const safeUrl = parseSafeArticleUrl(url);

		if (!safeUrl) {
			return { ok: false, reason: "URL is not a safe HTTP or HTTPS article URL" };
		}

		const response = await fetchArticleSource(safeUrl);

		if (!response.ok) {
			return { ok: false, reason: response.reason };
		}

		const html = extractReadableHtml(response.response.text, response.response.url, {
			includeRemoteImages: this.settings.includeRemoteImages,
		});

		if (!html) {
			return { ok: false, reason: "readable article extraction returned no content" };
		}

		return {
			ok: true,
			article: {
				html,
				fetchedAt: new Date().toISOString(),
			},
		};
	}
}

function hasMeaningfulContent(value: string | undefined): boolean {
	return Boolean(value?.trim());
}

async function fetchArticleSource(url: string): Promise<ArticleSourceResponseResult> {
	const response = await requestUrlWithTimeout({
		url,
		method: "GET",
		headers: ARTICLE_REQUEST_HEADERS,
		throw: false,
	});

	try {
		if (response.status >= 400) {
			return { ok: false, reason: `request returned HTTP ${response.status}` };
		}

		const contentLength = parseContentLength(response.headers["content-length"] ?? null);

		if (contentLength !== null && contentLength > MAX_ARTICLE_BYTES) {
			return { ok: false, reason: "response exceeded the configured size limit" };
		}

		if (!isSupportedContentType(response.headers["content-type"])) {
			return { ok: false, reason: "response content type is not supported" };
		}

		const text = response.text;
		const textBytes = new TextEncoder().encode(text).byteLength;

		if (textBytes > MAX_ARTICLE_BYTES) {
			return { ok: false, reason: "response exceeded the configured size limit" };
		}

		return {
			ok: true,
			response: {
				text,
				url,
			},
		};
	} catch (error) {
		if (error instanceof Error && error.message === "Article request timed out.") {
			return { ok: false, reason: "request timed out or was aborted" };
		}

		throw error;
	}
}

function requestUrlWithTimeout(params: Parameters<typeof requestUrl>[0]) {
	return new Promise<Awaited<ReturnType<typeof requestUrl>>>((resolve, reject) => {
		const timeoutId = window.setTimeout(() => reject(new Error("Article request timed out.")), ARTICLE_REQUEST_TIMEOUT_MS);

		void requestUrl(params)
			.then((response) => resolve(response))
			.catch((error: unknown) => reject(error instanceof Error ? error : new Error(String(error))))
			.finally(() => window.clearTimeout(timeoutId));
	});
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
		host.startsWith("::ffff:") ||
		host.startsWith("fc") ||
		host.startsWith("fd") ||
		host.startsWith("fe8") ||
		host.startsWith("fe9") ||
		host.startsWith("fea") ||
		host.startsWith("feb")
	);
}

function isSupportedContentType(contentType: string | null | undefined): boolean {
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

function parseContentLength(value: string | null): number | null {
	if (!value) {
		return null;
	}

	const contentLength = Number.parseInt(value, 10);

	return Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : null;
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
