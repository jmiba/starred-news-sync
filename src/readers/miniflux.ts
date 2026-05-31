import { epochToIso, joinUrl, requestJson, requireSetting, withQuery } from "./http";
import type { ReaderClient, StarredNewsItem, StarredNewsSyncSettings } from "../types";

interface MinifluxEntriesResponse {
	entries?: MinifluxEntry[];
}

interface MinifluxEntry {
	id?: number;
	title?: string;
	url?: string;
	author?: string;
	content?: string;
	published_at?: string;
	changed_at?: string;
	created_at?: string;
	feed?: {
		title?: string;
		feed_url?: string;
		site_url?: string;
	};
}

export class MinifluxClient implements ReaderClient {
	constructor(private readonly settings: StarredNewsSyncSettings) {}

	async getStarredItems(limit: number): Promise<StarredNewsItem[]> {
		const token = requireSetting(this.settings.accessToken, "Miniflux API token is required.");
		const response = await requestJson<MinifluxEntriesResponse>({
			url: withQuery(joinUrl(this.getApiUrl(), "entries"), {
				starred: true,
				limit: Math.min(limit, 100),
				order: "published_at",
				direction: "desc",
			}),
			headers: {
				"X-Auth-Token": token,
			},
		});

		return (response.entries || []).slice(0, limit).map((entry) => ({
			id: String(entry.id || entry.url || entry.title || "unknown-miniflux-item"),
			title: entry.title || "Untitled RSS item",
			url: entry.url || "",
			reader: "Miniflux",
			rawApiItem: entry,
			author: entry.author || undefined,
			feedTitle: entry.feed?.title,
			feedUrl: entry.feed?.feed_url || entry.feed?.site_url,
			publishedAt: normalizeIso(entry.published_at),
			updatedAt: normalizeIso(entry.changed_at || entry.created_at),
			contentHtml: entry.content,
		}));
	}

	private getApiUrl(): string {
		const configuredUrl = requireSetting(this.settings.apiUrl, "Miniflux API URL is required.").replace(/\/+$/, "");

		if (configuredUrl.endsWith("/v1")) {
			return configuredUrl;
		}

		return joinUrl(configuredUrl, "v1");
	}
}

function normalizeIso(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const parsed = Date.parse(value);

	if (!Number.isFinite(parsed)) {
		return undefined;
	}

	return epochToIso(parsed);
}
