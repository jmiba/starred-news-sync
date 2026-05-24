export type ReaderProvider =
	| "google-reader"
	| "fever"
	| "tiny-tiny-rss"
	| "inoreader"
	| "feedly"
	| "miniflux";

export type ArticleSourceMode = "missing" | "always";

export interface StarredNewsSyncSettings {
	provider: ReaderProvider;
	apiUrl: string;
	username: string;
	password: string;
	accessToken: string;
	appId: string;
	appKey: string;
	feedlyStreamId: string;
	outputFolder: string;
	importLimit: number;
	noteTemplatePath: string;
	includeArticleContent: boolean;
	fetchArticleSource: boolean;
	articleSourceMode: ArticleSourceMode;
	includeRemoteImages: boolean;
	noteTags: string;
	autoSync: boolean;
	syncIntervalMinutes: number;
}

export interface StarredNewsItem {
	id: string;
	title: string;
	url: string;
	reader: string;
	author?: string;
	feedTitle?: string;
	feedUrl?: string;
	publishedAt?: string;
	updatedAt?: string;
	contentHtml?: string;
	summaryHtml?: string;
	contentSource?: "reader" | "article_url";
	contentFetchedAt?: string;
}

export interface ReaderClient {
	getStarredItems(limit: number): Promise<StarredNewsItem[]>;
}

export interface SyncResult {
	fetched: number;
	imported: number;
	skipped: number;
	createdPaths: string[];
}
