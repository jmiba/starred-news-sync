import { epochToIso, requestJson, requireSetting } from "./http";
import type { ReaderClient, StarredNewsItem, StarredNewsSyncSettings } from "../types";

interface TinyTinyRssResponse<T> {
	status?: number;
	content?: T;
	error?: string;
}

interface TinyTinyRssLoginContent {
	session_id?: string;
}

interface TinyTinyRssHeadline {
	id?: number;
	title?: string;
	link?: string;
	author?: string;
	updated?: number;
	feed_title?: string;
	feed_url?: string;
	content?: string;
	excerpt?: string;
}

export class TinyTinyRssClient implements ReaderClient {
	constructor(private readonly settings: StarredNewsSyncSettings) {}

	async getStarredItems(limit: number): Promise<StarredNewsItem[]> {
		const sessionId = await this.login();

		try {
			const response = await this.call<TinyTinyRssHeadline[]>({
				op: "getHeadlines",
				sid: sessionId,
				feed_id: "-1",
				limit: Math.min(limit, 200),
				view_mode: "marked",
				show_content: true,
				include_attachments: true,
			});
			const headlines = this.getContent(response);

			return headlines.slice(0, limit).map((headline) => ({
				id: String(headline.id || headline.link || headline.title || "unknown-tt-rss-item"),
				title: headline.title || "Untitled RSS item",
				url: headline.link || "",
				reader: "Tiny Tiny RSS",
				rawApiItem: headline,
				author: headline.author || undefined,
				feedTitle: headline.feed_title,
				feedUrl: headline.feed_url,
				publishedAt: epochToIso(headline.updated),
				contentHtml: headline.content,
				summaryHtml: headline.excerpt,
			}));
		} finally {
			void this.call({
				op: "logout",
				sid: sessionId,
			}).catch(() => undefined);
		}
	}

	private async login(): Promise<string> {
		const username = requireSetting(this.settings.username, "Tiny Tiny RSS username is required.");
		const password = requireSetting(this.settings.password, "Tiny Tiny RSS password is required.");
		const response = await this.call<TinyTinyRssLoginContent>({
			op: "login",
			user: username,
			password,
		});
		const content = this.getContent(response);

		if (!content.session_id) {
			throw new Error("Tiny Tiny RSS did not return a session ID.");
		}

		return content.session_id;
	}

	private async call<T>(body: Record<string, unknown>): Promise<TinyTinyRssResponse<T>> {
		return requestJson<TinyTinyRssResponse<T>>({
			url: requireSetting(this.settings.apiUrl, "Tiny Tiny RSS API URL is required."),
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify(body),
		});
	}

	private getContent<T>(response: TinyTinyRssResponse<T>): T {
		if (response.status === 1 || response.error) {
			throw new Error(response.error || "Tiny Tiny RSS API returned an error.");
		}

		if (response.content === undefined) {
			throw new Error("Tiny Tiny RSS API response did not include content.");
		}

		return response.content;
	}
}
