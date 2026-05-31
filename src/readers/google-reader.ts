import { epochToIso, formBody, joinUrl, requestJson, requestText, requireSetting, withQuery } from "./http";
import type { ReaderClient, StarredNewsItem, StarredNewsSyncSettings } from "../types";

const STARRED_STREAM_ID = "user/-/state/com.google/starred";

interface GoogleReaderStreamResponse {
	items?: GoogleReaderItem[];
	continuation?: string;
}

interface GoogleReaderItem {
	id?: string;
	title?: string;
	author?: string;
	published?: number;
	updated?: number;
	crawlTimeMsec?: string;
	timestampUsec?: string;
	canonical?: GoogleReaderLink | GoogleReaderLink[];
	alternate?: GoogleReaderLink | GoogleReaderLink[];
	origin?: {
		title?: string;
		streamId?: string;
		htmlUrl?: string;
	};
	summary?: {
		content?: string;
	};
	content?: {
		content?: string;
	};
}

interface GoogleReaderLink {
	href?: string;
	type?: string;
}

export class GoogleReaderClient implements ReaderClient {
	protected readonly readerName: string = "Google Reader API";
	protected readonly defaultApiUrl: string = "";
	protected readonly encodeStreamPath: boolean = false;

	constructor(protected readonly settings: StarredNewsSyncSettings) {}

	async getStarredItems(limit: number): Promise<StarredNewsItem[]> {
		const headers = await this.getAuthHeaders();
		const items: StarredNewsItem[] = [];
		let continuation: string | undefined;

		do {
			const remaining = limit - items.length;
			const pageSize = Math.min(100, remaining);
			const streamPath = this.encodeStreamPath ? encodeURIComponent(STARRED_STREAM_ID) : STARRED_STREAM_ID;
			const url = withQuery(joinUrl(this.getApiUrl(), `reader/api/0/stream/contents/${streamPath}`), {
				output: "json",
				n: pageSize,
				c: continuation,
			});
			const response = await requestJson<GoogleReaderStreamResponse>({ url, headers });

			for (const item of response.items || []) {
				items.push(this.mapItem(item));

				if (items.length >= limit) {
					break;
				}
			}

			continuation = response.continuation;
		} while (continuation && items.length < limit);

		return items;
	}

	protected getApiUrl(): string {
		const configuredUrl = this.settings.apiUrl.trim();

		if (configuredUrl) {
			return configuredUrl;
		}

		return requireSetting(this.defaultApiUrl, "API URL is required.");
	}

	protected async getAuthHeaders(): Promise<Record<string, string>> {
		const extraHeaders = this.getExtraHeaders();
		const accessToken = this.settings.accessToken.trim();

		if (accessToken) {
			return {
				...extraHeaders,
				Authorization: this.formatAccessToken(accessToken),
			};
		}

		const username = requireSetting(this.settings.username, "Username is required.");
		const password = requireSetting(this.settings.password, "Password or API password is required.");
		const loginResponse = await requestText({
			url: joinUrl(this.getApiUrl(), "accounts/ClientLogin"),
			method: "POST",
			contentType: "application/x-www-form-urlencoded",
			body: formBody({
				Email: username,
				Passwd: password,
			}),
			headers: extraHeaders,
		});
		const authToken = parseClientLoginToken(loginResponse);

		return {
			...extraHeaders,
			Authorization: `GoogleLogin auth=${authToken}`,
		};
	}

	protected getExtraHeaders(): Record<string, string> {
		return {};
	}

	protected formatAccessToken(token: string): string {
		if (/^(Bearer|GoogleLogin|OAuth)\s/i.test(token)) {
			return token;
		}

		return `GoogleLogin auth=${token}`;
	}

	private mapItem(item: GoogleReaderItem): StarredNewsItem {
		const id = item.id || firstDefined(item.canonical, item.alternate) || item.title || "unknown-google-reader-item";
		const contentHtml = item.content?.content;
		const summaryHtml = item.summary?.content;

		return {
			id,
			title: item.title || "Untitled RSS item",
			url: firstDefined(item.canonical, item.alternate) || "",
			reader: this.readerName,
			rawApiItem: item,
			author: item.author || undefined,
			feedTitle: item.origin?.title,
			feedUrl: item.origin?.htmlUrl || item.origin?.streamId,
			publishedAt: epochToIso(item.published || item.timestampUsec || item.crawlTimeMsec),
			updatedAt: epochToIso(item.updated),
			contentHtml,
			summaryHtml,
		};
	}
}

export class InoreaderClient extends GoogleReaderClient {
	protected readonly readerName: string = "Inoreader";
	protected readonly defaultApiUrl: string = "https://www.inoreader.com";
	protected readonly encodeStreamPath: boolean = true;

	protected getExtraHeaders(): Record<string, string> {
		const headers: Record<string, string> = {};

		if (this.settings.appId.trim()) {
			headers.AppId = this.settings.appId.trim();
		}

		if (this.settings.appKey.trim()) {
			headers.AppKey = this.settings.appKey.trim();
		}

		return headers;
	}

	protected formatAccessToken(token: string): string {
		if (/^(Bearer|GoogleLogin|OAuth)\s/i.test(token)) {
			return token;
		}

		return `Bearer ${token}`;
	}
}

function parseClientLoginToken(response: string): string {
	const line = response
		.split(/\r?\n/)
		.map((entry) => entry.trim())
		.find((entry) => entry.startsWith("Auth="));

	if (!line) {
		throw new Error("Reader did not return a ClientLogin auth token.");
	}

	return line.slice("Auth=".length);
}

function firstDefined(...values: Array<GoogleReaderLink | GoogleReaderLink[] | undefined>): string | undefined {
	for (const value of values) {
		const href = firstHref(value);

		if (href) {
			return href;
		}
	}

	return undefined;
}

function firstHref(value: GoogleReaderLink | GoogleReaderLink[] | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	if (Array.isArray(value)) {
		return value.find((link) => Boolean(link.href))?.href;
	}

	return value.href;
}
