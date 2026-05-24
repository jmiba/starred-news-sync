import { md5 } from "../utils/md5";
import { epochToIso, formBody, requestJson, requireSetting, withQuery } from "./http";
import type { ReaderClient, StarredNewsItem, StarredNewsSyncSettings } from "../types";

interface FeverResponse {
	auth?: number;
	saved_item_ids?: string;
	items?: FeverItem[];
	feeds?: FeverFeed[];
}

interface FeverItem {
	id: number;
	feed_id: number;
	title?: string;
	author?: string;
	html?: string;
	url?: string;
	is_saved?: number;
	created_on_time?: number;
}

interface FeverFeed {
	id: number;
	title?: string;
	url?: string;
	site_url?: string;
}

export class FeverClient implements ReaderClient {
	constructor(private readonly settings: StarredNewsSyncSettings) {}

	async getStarredItems(limit: number): Promise<StarredNewsItem[]> {
		const savedResponse = await this.call({
			saved_item_ids: null,
		});
		this.assertAuthenticated(savedResponse);

		const ids = parseIdList(savedResponse.saved_item_ids).slice(0, limit);

		if (ids.length === 0) {
			return [];
		}

		const feedById = await this.getFeedMap();
		const itemById = new Map<number, FeverItem>();

		for (const idChunk of chunks(ids, 50)) {
			const itemResponse = await this.call({
				items: null,
				with_ids: idChunk.join(","),
			});
			this.assertAuthenticated(itemResponse);

			for (const item of itemResponse.items || []) {
				itemById.set(item.id, item);
			}
		}

		return ids
			.map((id) => itemById.get(id))
			.filter((item): item is FeverItem => Boolean(item))
			.map((item) => {
				const feed = feedById.get(item.feed_id);

				return {
					id: String(item.id),
					title: item.title || "Untitled RSS item",
					url: item.url || "",
					reader: "Fever API",
					author: item.author || undefined,
					feedTitle: feed?.title,
					feedUrl: feed?.site_url || feed?.url,
					publishedAt: epochToIso(item.created_on_time),
					contentHtml: item.html,
				};
			});
	}

	private async getFeedMap(): Promise<Map<number, FeverFeed>> {
		try {
			const response = await this.call({
				feeds: null,
			});
			this.assertAuthenticated(response);

			return new Map((response.feeds || []).map((feed) => [feed.id, feed]));
		} catch (error) {
			console.warn("Unable to fetch Fever feeds; imported notes will omit feed metadata.", error);
			return new Map();
		}
	}

	private async call(params: Record<string, string | number | boolean | null>): Promise<FeverResponse> {
		const url = withQuery(this.getApiUrl(), {
			api: null,
			...params,
		});

		return requestJson<FeverResponse>({
			url,
			method: "POST",
			contentType: "application/x-www-form-urlencoded",
			body: formBody({
				api_key: this.getApiKey(),
			}),
		});
	}

	private getApiUrl(): string {
		return requireSetting(this.settings.apiUrl, "Fever API URL is required.");
	}

	private getApiKey(): string {
		const configuredApiKey = this.settings.accessToken.trim();

		if (configuredApiKey) {
			return configuredApiKey;
		}

		const username = requireSetting(this.settings.username, "Fever username is required.");
		const password = requireSetting(this.settings.password, "Fever API password is required.");

		return md5(`${username}:${password}`);
	}

	private assertAuthenticated(response: FeverResponse): void {
		if (response.auth !== 1) {
			throw new Error("Fever API authentication failed.");
		}
	}
}

function parseIdList(value: string | undefined): number[] {
	if (!value) {
		return [];
	}

	return value
		.split(",")
		.map((id) => Number.parseInt(id, 10))
		.filter((id) => Number.isFinite(id));
}

function chunks<T>(values: T[], chunkSize: number): T[][] {
	const result: T[][] = [];

	for (let index = 0; index < values.length; index += chunkSize) {
		result.push(values.slice(index, index + chunkSize));
	}

	return result;
}
