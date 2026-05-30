import type { StarredNewsItem, StarredNewsSyncSettings } from "./types";

export function logDebug(
	settings: Pick<StarredNewsSyncSettings, "enableDebugLogging">,
	item: Pick<StarredNewsItem, "id" | "title" | "url">,
	message: string,
	details?: Record<string, unknown>
): void {
	if (!settings.enableDebugLogging) {
		return;
	}

	console.debug(`[Starred News Sync] ${message}`, {
		id: item.id,
		title: item.title,
		url: item.url,
		...(details || {}),
	});
}