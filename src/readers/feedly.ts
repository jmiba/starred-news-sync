import { epochToIso, joinUrl, requestJson, requireSetting, withQuery } from "./http";
import type { ReaderClient, StarredNewsItem, StarredNewsSyncSettings } from "../types";

interface FeedlyStreamResponse {
	items?: FeedlyItem[];
	continuation?: string;
}

interface FeedlyItem {
	id?: string;
	title?: string;
	author?: string;
	published?: number;
	updated?: number;
	crawled?: number;
	canonicalUrl?: string;
	alternate?: Array<{
		href?: string;
		type?: string;
	}>;
	origin?: {
		title?: string;
		htmlUrl?: string;
		streamId?: string;
	};
	content?: {
		content?: string;
	};
	summary?: {
		content?: string;
	};
}

export class FeedlyClient implements ReaderClient {
	constructor(private readonly settings: StarredNewsSyncSettings) {}

	async getStarredItems(limit: number): Promise<StarredNewsItem[]> {
		const token = requireSetting(this.settings.accessToken, "Feedly access token is required.");
		const streamId = requireSetting(this.settings.feedlyStreamId, "Feedly stream ID is required.");
		const items: StarredNewsItem[] = [];
		let continuation: string | undefined;

		do {
			const response = await requestJson<FeedlyStreamResponse>({
				url: withQuery(joinUrl(this.getApiUrl(), "streams/contents"), {
					streamID: streamId,
					count: Math.min(100, limit - items.length),
					continuation,
					includeAiActions: false,
					similar: false,
				}),
				headers: {
					Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
				},
			});

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

	private getApiUrl(): string {
		return this.settings.apiUrl.trim() || "https://api.feedly.com/v3";
	}

	private mapItem(item: FeedlyItem): StarredNewsItem {
		const url = item.canonicalUrl || item.alternate?.find((link) => Boolean(link.href))?.href || "";

		return {
			id: item.id || url || item.title || "unknown-feedly-item",
			title: item.title || "Untitled RSS item",
			url,
			reader: "Feedly",
			rawApiItem: item,
			author: item.author || undefined,
			feedTitle: item.origin?.title,
			feedUrl: item.origin?.htmlUrl || item.origin?.streamId,
			publishedAt: epochToIso(item.published || item.crawled),
			updatedAt: epochToIso(item.updated),
			contentHtml: item.content?.content,
			summaryHtml: item.summary?.content,
		};
	}
}
