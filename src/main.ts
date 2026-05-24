import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, StarredNewsSettingTab } from "./settings";
import { StarredNewsSyncer } from "./syncer";
import type { StarredNewsSyncSettings } from "./types";

export default class StarredNewsSyncPlugin extends Plugin {
	settings: StarredNewsSyncSettings;
	private autoSyncIntervalId: number | null = null;
	private syncInProgress = false;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon("star", "Sync starred news", () => {
			void this.syncStarredItems();
		});

		this.addCommand({
			id: "sync-starred-items",
			name: "Sync starred items now",
			callback: () => {
				void this.syncStarredItems();
			},
		});

		this.addSettingTab(new StarredNewsSettingTab(this.app, this));
		this.configureAutoSync();
	}

	onunload(): void {
		this.clearAutoSyncInterval();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<StarredNewsSyncSettings>
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	configureAutoSync(): void {
		this.clearAutoSyncInterval();

		if (!this.settings.autoSync) {
			return;
		}

		const intervalMinutes = Math.max(5, this.settings.syncIntervalMinutes);
		this.autoSyncIntervalId = window.setInterval(() => {
			void this.syncStarredItems({ silent: true });
		}, intervalMinutes * 60 * 1000);
		this.registerInterval(this.autoSyncIntervalId);
	}

	async syncStarredItems(options: { silent?: boolean } = {}): Promise<void> {
		if (this.syncInProgress) {
			if (!options.silent) {
				new Notice("Starred news sync is already running.");
			}
			return;
		}

		this.syncInProgress = true;

		try {
			const syncer = new StarredNewsSyncer(this.app, this.settings);
			const result = await syncer.sync();

			if (!options.silent) {
				new Notice(
					`Starred news sync imported ${result.imported} item(s); skipped ${result.skipped} existing note(s).`
				);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Starred news sync failed: ${message}`);
			console.error("Starred News Sync failed", error);
		} finally {
			this.syncInProgress = false;
		}
	}

	private clearAutoSyncInterval(): void {
		if (this.autoSyncIntervalId === null) {
			return;
		}

		window.clearInterval(this.autoSyncIntervalId);
		this.autoSyncIntervalId = null;
	}
}
