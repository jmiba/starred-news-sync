# Starred News Sync Architecture

Starred News Sync imports saved RSS reader items through configurable reader APIs and writes them as Markdown notes with stable YAML metadata.

The central flow is [[architecture#Plugin lifecycle]] -> [[architecture#Settings contract]] -> [[architecture#Sync orchestration]] -> [[architecture#Reader adapter boundary]] -> [[architecture#Note writing]].

## Plugin lifecycle

The plugin lifecycle stays thin: load settings, register the sync command and ribbon action, configure optional interval sync, and delegate work to the syncer.

The lifecycle is implemented by [[src/main.ts#StarredNewsSyncPlugin]]. It owns user-triggered sync, automatic sync scheduling, and user-facing notices, but not reader protocol details.

## Settings contract

Settings capture the reader connection, import behavior, note metadata defaults, and automatic sync interval.

The settings model is defined in [[src/types.ts#StarredNewsSyncSettings]]. The settings UI and defaults live in [[src/settings.ts#StarredNewsSettingTab]] and [[src/settings.ts#DEFAULT_SETTINGS]].

## Sync orchestration

Sync orchestration creates the selected reader client, fetches a bounded number of starred items, and passes normalized items to the note writer.

The orchestration boundary is [[src/syncer.ts#StarredNewsSyncer]]. It depends on [[architecture#Reader adapter boundary]] for fetching and [[architecture#Note writing]] for vault writes.

## Reader adapter boundary

Reader adapters normalize different RSS reader APIs into the shared `StarredNewsItem` shape used by note creation.

The client factory is [[src/readers/index.ts#createReaderClient]]. Supported implementations include [[lat.md/architecture#Starred News Sync Architecture#Reader adapter boundary#Google Reader-compatible adapters]], [[lat.md/architecture#Starred News Sync Architecture#Reader adapter boundary#Fever adapter]], [[lat.md/architecture#Starred News Sync Architecture#Reader adapter boundary#Tiny Tiny RSS adapter]], and [[lat.md/architecture#Starred News Sync Architecture#Reader adapter boundary#Hosted token adapters]].

### Google Reader-compatible adapters

Google Reader-compatible clients fetch the starred stream and map canonical links, origin metadata, dates, summary, and content into `StarredNewsItem`.

FreshRSS-style APIs use [[src/readers/google-reader.ts#GoogleReaderClient]]. Inoreader reuses that flow with provider-specific defaults and headers through [[src/readers/google-reader.ts#InoreaderClient]].

### Fever adapter

The Fever adapter imports saved item IDs, fetches item batches, and enriches notes with feed metadata when the reader exposes it.

The implementation is [[src/readers/fever.ts#FeverClient]]. Fever API-key generation uses [[src/utils/md5.ts#md5]] when the user provides username and API password rather than a precomputed key.

### Tiny Tiny RSS adapter

The Tiny Tiny RSS adapter logs in, fetches marked headlines from the special starred feed, and logs out after the request.

The implementation is [[src/readers/tiny-tiny-rss.ts#TinyTinyRssClient]]. It is the only current adapter with an explicit session lifecycle.

### Hosted token adapters

Hosted token adapters use bearer or API tokens rather than storing account passwords.

Feedly stream imports are implemented by [[src/readers/feedly.ts#FeedlyClient]]. Miniflux starred entries are implemented by [[src/readers/miniflux.ts#MinifluxClient]].

## Note writing

Note writing owns vault folder creation, duplicate checks by generated path, YAML frontmatter, Markdown body formatting, and imported filename rules.

The writer is [[src/note-writer.ts#NoteWriter]]. HTML returned by readers is converted by [[src/utils/html-to-markdown.ts#htmlToMarkdown]], while note filenames use an Obsidian-safe article title followed by ` - RSS ` and a short hash.
