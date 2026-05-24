import { FeedlyClient } from "./feedly";
import { FeverClient } from "./fever";
import { GoogleReaderClient, InoreaderClient } from "./google-reader";
import { MinifluxClient } from "./miniflux";
import { TinyTinyRssClient } from "./tiny-tiny-rss";
import type { ReaderClient, StarredNewsSyncSettings } from "../types";

export function createReaderClient(settings: StarredNewsSyncSettings): ReaderClient {
	switch (settings.provider) {
		case "google-reader":
			return new GoogleReaderClient(settings);
		case "fever":
			return new FeverClient(settings);
		case "tiny-tiny-rss":
			return new TinyTinyRssClient(settings);
		case "inoreader":
			return new InoreaderClient(settings);
		case "feedly":
			return new FeedlyClient(settings);
		case "miniflux":
			return new MinifluxClient(settings);
	}
}
