import type { App } from "obsidian";
import { NoteWriter } from "./note-writer";
import { createReaderClient } from "./readers";
import type { StarredNewsSyncSettings, SyncResult } from "./types";

export class StarredNewsSyncer {
	constructor(
		private readonly app: App,
		private readonly settings: StarredNewsSyncSettings
	) {}

	async sync(): Promise<SyncResult> {
		const client = createReaderClient(this.settings);
		const limit = Math.max(1, this.settings.importLimit);
		const items = await client.getStarredItems(limit);
		const writer = new NoteWriter(this.app);

		return writer.writeItems(items, this.settings);
	}
}
