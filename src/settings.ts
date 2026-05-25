import { App, PluginSettingTab, Setting } from "obsidian";
import type StarredNewsSyncPlugin from "./main";
import type { ArticleSourceMode, ReaderProvider, StarredNewsSyncSettings } from "./types";

export const DEFAULT_SETTINGS: StarredNewsSyncSettings = {
	provider: "google-reader",
	apiUrl: "",
	username: "",
	password: "",
	accessToken: "",
	appId: "",
	appKey: "",
	feedlyStreamId: "",
	outputFolder: "Starred news",
	importLimit: 50,
	detectDuplicateUrls: false,
	duplicateUrlFrontmatterProperty: "url",
	noteTemplatePath: "",
	includeArticleContent: true,
	fetchArticleSource: false,
	articleSourceMode: "missing",
	includeRemoteImages: false,
	noteTags: "rss-starred, news",
	syncOnStartup: false,
	autoSync: false,
	syncIntervalMinutes: 60,
};

const PROVIDER_LABELS: Record<ReaderProvider, string> = {
	"google-reader": "Google Reader-compatible",
	fever: "Fever-compatible",
	"tiny-tiny-rss": "Tiny Tiny RSS",
	inoreader: "Inoreader",
	feedly: "Feedly",
	miniflux: "Miniflux",
};

const DEFAULT_PROVIDER_URLS: Partial<Record<ReaderProvider, string>> = {
	inoreader: "https://www.inoreader.com",
	feedly: "https://api.feedly.com/v3",
};

export class StarredNewsSettingTab extends PluginSettingTab {
	plugin: StarredNewsSyncPlugin;

	constructor(app: App, plugin: StarredNewsSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const settings = this.plugin.settings;

		containerEl.empty();
		new Setting(containerEl).setName("Connection").setHeading();

		new Setting(containerEl)
			.setName("Reader endpoint")
			.setDesc("Select the endpoint type that your RSS reader exposes.")
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(PROVIDER_LABELS)) {
					dropdown.addOption(value, label);
				}

				dropdown.setValue(settings.provider).onChange(async (value) => {
					settings.provider = value as ReaderProvider;
					settings.apiUrl = settings.apiUrl || DEFAULT_PROVIDER_URLS[settings.provider] || "";
					await this.saveAndRefresh();
				});
			});

		new Setting(containerEl)
			.setName("Endpoint")
			.setDesc(this.getApiUrlDescription(settings.provider))
			.addText((text) => {
				text.setPlaceholder(this.getApiUrlPlaceholder(settings.provider))
					.setValue(settings.apiUrl)
					.onChange(async (value) => {
						settings.apiUrl = value.trim();
						await this.plugin.saveSettings();
					});
			});

		if (this.usesUsernamePassword(settings.provider)) {
			new Setting(containerEl)
				.setName("Username")
				.setDesc("Use the account username or email required by the selected reader API.")
				.addText((text) => {
					text.setValue(settings.username).onChange(async (value) => {
						settings.username = value.trim();
						await this.plugin.saveSettings();
					});
				});

			new Setting(containerEl)
				.setName("Password or API password")
				.setDesc("Prefer a dedicated API password when your reader supports one.")
				.addText((text) => {
					text.inputEl.type = "password";
					text.setValue(settings.password).onChange(async (value) => {
						settings.password = value;
						await this.plugin.saveSettings();
					});
				});
		}

		new Setting(containerEl)
			.setName(this.getAccessTokenName(settings.provider))
			.setDesc(this.getAccessTokenDescription(settings.provider))
			.addText((text) => {
				text.inputEl.type = "password";
				text.setValue(settings.accessToken).onChange(async (value) => {
					settings.accessToken = value.trim();
					await this.plugin.saveSettings();
				});
			});

		if (settings.provider === "inoreader") {
			new Setting(containerEl)
				.setName("Inoreader app identifier")
				.setDesc("Optional. Needed only for legacy client login integrations that use app authentication.")
				.addText((text) => {
					text.setValue(settings.appId).onChange(async (value) => {
						settings.appId = value.trim();
						await this.plugin.saveSettings();
					});
				});

			new Setting(containerEl)
				.setName("Inoreader app key")
				.setDesc("Optional. Pair this with the app identifier when using legacy client login.")
				.addText((text) => {
					text.inputEl.type = "password";
					text.setValue(settings.appKey).onChange(async (value) => {
						settings.appKey = value.trim();
						await this.plugin.saveSettings();
					});
				});
		}

		if (settings.provider === "feedly") {
			new Setting(containerEl)
				.setName("Feedly stream identifier")
				.setDesc("For saved items, use a board, folder, or saved stream identifier.")
				.addText((text) => {
					text.setPlaceholder("enterprise/acme/tag/global.all")
						.setValue(settings.feedlyStreamId)
						.onChange(async (value) => {
							settings.feedlyStreamId = value.trim();
							await this.plugin.saveSettings();
						});
				});
		}

		new Setting(containerEl).setName("Import").setHeading();

		new Setting(containerEl)
			.setName("Output folder")
			.setDesc("Imported notes are created here. The folder is created if needed.")
			.addText((text) => {
				text.setPlaceholder("Starred news")
					.setValue(settings.outputFolder)
					.onChange(async (value) => {
						settings.outputFolder = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Import limit")
			.setDesc("Maximum starred items to fetch per sync.")
			.addText((text) => {
				text.setPlaceholder("50")
					.setValue(String(settings.importLimit))
					.onChange(async (value) => {
						settings.importLimit = parsePositiveInteger(value, DEFAULT_SETTINGS.importLimit, 1, 500);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Note tags")
			.setDesc("Comma-separated tags added to YAML frontmatter.")
			.addText((text) => {
				text.setValue(settings.noteTags).onChange(async (value) => {
					settings.noteTags = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Skip duplicate links")
			.setDesc("Skip reader items whose link already appears in YAML frontmatter in the vault.")
			.addToggle((toggle) => {
				toggle.setValue(settings.detectDuplicateUrls).onChange(async (value) => {
					settings.detectDuplicateUrls = value;
					await this.saveAndRefresh();
				});
			});

		if (settings.detectDuplicateUrls) {
			new Setting(containerEl)
				.setName("Duplicate URL property")
				.setDesc("YAML frontmatter property compared with RSS item links. Use commas for multiple legacy names.")
				.addText((text) => {
					text.setPlaceholder(DEFAULT_SETTINGS.duplicateUrlFrontmatterProperty)
						.setValue(settings.duplicateUrlFrontmatterProperty)
						.onChange(async (value) => {
							settings.duplicateUrlFrontmatterProperty = value.trim();
							await this.plugin.saveSettings();
						});
				});
		}

		new Setting(containerEl)
			.setName("Note template")
			.setDesc("Optional vault path to a template file; templater can use the injected RSS object when installed.")
			.addText((text) => {
				text.setPlaceholder("Template path")
					.setValue(settings.noteTemplatePath)
					.onChange(async (value) => {
						settings.noteTemplatePath = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Include article content")
			.setDesc("When available, write the article summary or HTML content into the note body.")
			.addToggle((toggle) => {
				toggle.setValue(settings.includeArticleContent).onChange(async (value) => {
					settings.includeArticleContent = value;
					await this.saveAndRefresh();
				});
			});

		if (settings.includeArticleContent) {
			new Setting(containerEl)
				.setName("Fetch article source text")
				.setDesc("Optional. Requests article pages for new imports and extracts readable text from the returned HTML.")
				.addToggle((toggle) => {
					toggle.setValue(settings.fetchArticleSource).onChange(async (value) => {
						settings.fetchArticleSource = value;
						await this.saveAndRefresh();
					});
				});

			if (settings.fetchArticleSource) {
				new Setting(containerEl)
					.setName("Source fetch mode")
					.setDesc("Choose whether reader API content or article page content should be preferred.")
					.addDropdown((dropdown) => {
						dropdown
							.addOption("missing", "When reader content is missing")
							.addOption("always", "Always prefer article page")
							.setValue(settings.articleSourceMode)
							.onChange(async (value) => {
								settings.articleSourceMode = value as ArticleSourceMode;
								await this.plugin.saveSettings();
							});
					});

				new Setting(containerEl)
					.setName("Include remote images")
					.setDesc("Keep HTTP and HTTPS image links from fetched article pages. Previewing notes may contact image hosts.")
					.addToggle((toggle) => {
						toggle.setValue(settings.includeRemoteImages).onChange(async (value) => {
							settings.includeRemoteImages = value;
							await this.plugin.saveSettings();
						});
					});
			}
		}

		new Setting(containerEl).setName("Sync").setHeading();

		new Setting(containerEl)
			.setName("Sync on startup")
			.setDesc("Run one sync after Obsidian opens and the workspace is ready.")
			.addToggle((toggle) => {
				toggle.setValue(settings.syncOnStartup).onChange(async (value) => {
					settings.syncOnStartup = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Automatic sync")
			.setDesc("Run sync on an interval while Obsidian is open.")
			.addToggle((toggle) => {
				toggle.setValue(settings.autoSync).onChange(async (value) => {
					settings.autoSync = value;
					await this.plugin.saveSettings();
					this.plugin.configureAutoSync();
				});
			});

		new Setting(containerEl)
			.setName("Sync interval")
			.setDesc("Minutes between automatic syncs. Minimum is 5 minutes.")
			.addText((text) => {
				text.setPlaceholder("60")
					.setValue(String(settings.syncIntervalMinutes))
					.onChange(async (value) => {
						settings.syncIntervalMinutes = parsePositiveInteger(
							value,
							DEFAULT_SETTINGS.syncIntervalMinutes,
							5,
							1440
						);
						await this.plugin.saveSettings();
						this.plugin.configureAutoSync();
					});
			});

		new Setting(containerEl)
			.setName("Sync now")
			.setDesc("Import the current starred items using these settings.")
			.addButton((button) => {
				button.setButtonText("Sync now").setCta().onClick(() => {
					void this.plugin.syncStarredItems();
				});
			});
	}

	private async saveAndRefresh(): Promise<void> {
		await this.plugin.saveSettings();
		this.plugin.configureAutoSync();
		this.display();
	}

	private usesUsernamePassword(provider: ReaderProvider): boolean {
		return provider !== "feedly" && provider !== "miniflux";
	}

	private getApiUrlDescription(provider: ReaderProvider): string {
		switch (provider) {
			case "google-reader":
				return "FreshRSS example: https://rss.example.com/api/greader.php";
			case "fever":
				return "FreshRSS example: https://rss.example.com/api/fever.php";
			case "tiny-tiny-rss":
				return "Tiny Tiny RSS example: https://rss.example.com/tt-rss/api/";
			case "inoreader":
				return "Use https://www.inoreader.com unless you have a compatible proxy.";
			case "feedly":
				return "Use https://api.feedly.com/v3 for Feedly API tokens.";
			case "miniflux":
				return "Miniflux example: https://rss.example.com";
		}
	}

	private getApiUrlPlaceholder(provider: ReaderProvider): string {
		return DEFAULT_PROVIDER_URLS[provider] || "https://rss.example.com/api/greader.php";
	}

	private getAccessTokenName(provider: ReaderProvider): string {
		if (provider === "fever") {
			return "Fever API key";
		}

		return "Access token";
	}

	private getAccessTokenDescription(provider: ReaderProvider): string {
		switch (provider) {
			case "feedly":
				return "Required. Paste a Feedly bearer token with access to the configured stream.";
			case "miniflux":
				return "Required. Paste a Miniflux API token.";
			case "inoreader":
				return "Optional. Paste an OAuth bearer token to avoid storing your Inoreader password.";
			case "google-reader":
				return "Optional. Paste a GoogleLogin token if you do not want to use username/password login.";
			case "fever":
				return "Optional. Paste the 32-character MD5 Fever API key instead of storing username/password.";
			case "tiny-tiny-rss":
				return "Unused for Tiny Tiny RSS.";
		}
	}
}

function parsePositiveInteger(value: string, fallback: number, min: number, max: number): number {
	const parsed = Number.parseInt(value, 10);

	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.max(min, Math.min(max, parsed));
}
