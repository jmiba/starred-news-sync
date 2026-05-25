# Starred News Sync

Import starred or saved RSS reader items into Obsidian as Markdown notes with YAML frontmatter.

[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.18341648-blue)](https://doi.org/10.5281/zenodo.20370046)


## Features

- Adds a **Sync starred items now** command and ribbon action.
- Imports each item once using an Obsidian-safe filename in the form `Article title - RSS shortHash.md`.
- Creates notes with YAML fields for title, URL, reader, feed, author, published date, import date, and tags.
- Supports manual sync and optional interval sync while Obsidian is open.
- Converts returned HTML summaries/content into Markdown and strips unsafe HTML elements and event attributes.
- Optionally fetches the original article page for new imports and extracts readable content with Defuddle.
- Keeps fetched article images only when remote images are explicitly enabled.
- Can render imported notes from an optional Templater-compatible template.
- Can skip items whose URL already exists in configurable YAML frontmatter fields.

## Supported readers

| Reader | Plugin provider | Setup notes |
| --- | --- | --- |
| FreshRSS | Google Reader-compatible or Fever-compatible | Use the API URLs from FreshRSS settings, usually `/api/greader.php` or `/api/fever.php`, with the FreshRSS API password. |
| Tiny Tiny RSS | Tiny Tiny RSS | Enable the JSON API and use the `/api/` endpoint. Starred items are imported from the special starred feed. |
| Inoreader | Inoreader | Use `https://www.inoreader.com`. OAuth bearer token is preferred; legacy ClientLogin can use username/password plus optional App ID/App Key. |
| Feedly | Feedly | Requires a Feedly API bearer token and a stream ID. For Feedly Teams this is usually a board, folder, or AI Feed stream ID. |
| Miniflux | Miniflux | Use a Miniflux API token. The plugin fetches `/v1/entries?starred=true`. Miniflux can also be used through its Fever API. |

Other likely compatible readers include services or servers that expose Google Reader-compatible or Fever-compatible APIs, such as CommaFeed, FeedHQ, The Old Reader, and BazQux. Compatibility depends on the exact API variant and authentication requirements.

## Settings

- **Reader API**: Select the API type your reader exposes.
- **API URL**: The root endpoint for that API. Examples:
  - FreshRSS Google Reader: `https://rss.example.com/api/greader.php`
  - FreshRSS Fever: `https://rss.example.com/api/fever.php`
  - Tiny Tiny RSS: `https://rss.example.com/tt-rss/api/`
  - Miniflux: `https://rss.example.com`
- **Username** and **Password or API password**: Used by Google Reader-compatible, Fever, Tiny Tiny RSS, and legacy Inoreader flows.
- **Access token**: Used by Feedly, Miniflux, OAuth-based Inoreader, or precomputed GoogleLogin/Fever tokens.
- **Output folder**: Destination folder in the vault.
- **Note tags**: Comma-separated YAML tags added to imported notes.
- **Skip duplicate links**: Optional. Skips reader items whose URL already appears in configured YAML frontmatter fields inside the output folder.
- **Duplicate URL property**: YAML frontmatter property compared with incoming item URLs. Defaults to `url`; comma-separated legacy names are supported.
- **Note template**: Optional vault path to a Markdown template. If Templater is installed, Templater commands are rendered with the imported RSS item injected as `rss`.
- **Fetch article source text**: Optional. Requests each article page for new imports, extracts readable content, and records `content_source` and `content_fetched_at` in frontmatter.
- **Source fetch mode**: Choose whether article pages are fetched only when reader content is missing or always preferred over reader content.
- **Include remote images**: Optional. Keeps safe HTTP and HTTPS image links from fetched article pages. Off by default because previewing notes may contact image hosts.
- **Automatic sync**: Runs sync on an interval while Obsidian is open.

Credentials are stored in this plugin's Obsidian data file. By default, the plugin only sends network requests to the reader API URL you configure.

The plugin always skips an item when its generated note path already exists. When **Skip duplicate links** is enabled, the plugin also scans Markdown frontmatter in the configured **Output folder** for the configured property names before importing. The scan is limited to the output folder and its subfolders, so moved or renamed notes are detected when their configured URL frontmatter remains in that folder tree. URLs are compared after light normalization: surrounding whitespace and URL fragments are ignored, hostnames are compared case-insensitively, default HTTP/HTTPS ports are ignored, and trailing path slashes are ignored. Query strings are preserved.

If **Fetch article source text** is enabled, the plugin also requests article URLs from your starred items and extracts readable content with [Defuddle](https://github.com/kepano/defuddle). It only accepts HTTP and HTTPS URLs, skips localhost/private-network-style hosts, limits article responses to 2 MB, removes scripts/forms/active content/inline event handlers, disables Defuddle's async third-party fallbacks, and converts the extracted HTML to Markdown before writing notes. Remote article images are removed unless **Include remote images** is enabled; when enabled, only safe HTTP and HTTPS image links are kept, and Obsidian may contact those image hosts when rendering notes. This may still disclose your IP address and user agent to article websites.

## Templates

Set **Note template** to a vault path such as `Templates/Starred news item`. Wikilinks such as `[[Templates/Starred news item]]` also work. When [Templater](https://github.com/SilentVoid13/Templater) is installed, the plugin injects these objects before rendering:

- `rss`: the full import context.
- `item`: alias for `rss.item`, containing normalized reader fields.
- `content`: alias for `rss.content`, containing selected HTML/Markdown content fields.

Common fields include `rss.title`, `rss.url`, `rss.reader`, `rss.author`, `rss.feedTitle`, `rss.feedUrl`, `rss.publishedAt`, `rss.updatedAt`, `rss.importedAt`, `rss.tags`, `rss.notePath`, `rss.fileName`, `rss.shortHash`, `rss.byline`, `rss.contentHtml`, `rss.summaryHtml`, `rss.selectedContentHtml`, `rss.contentMarkdown`, `rss.summaryMarkdown`, `rss.contentSource`, and `rss.contentFetchedAt`. The default YAML fields are also available as `rss.frontmatter`.

Example template:

```md
---
title: <% JSON.stringify(rss.title) %>
url: <% JSON.stringify(rss.url) %>
reader: <% JSON.stringify(rss.reader) %>
imported: <% JSON.stringify(rss.importedAt) %>
tags:
<%* for (const tag of rss.tags) { tR += `  - ${JSON.stringify(tag)}\n`; } -%>
---
# <% rss.title %>

<% rss.byline %>

[Read original](<% rss.url %>)

<% rss.contentMarkdown %>
```

If Templater is not installed, the plugin still replaces simple placeholders such as `{{rss.title}}`, `{{rss.contentMarkdown}}`, and `{{content.markdown}}`. Templater JavaScript blocks only run when Templater is installed. Use templates you trust, because Templater templates can execute JavaScript.

If you want to perform additional AI processing of the imported news items (e.g. automatic tagging, abstract writing etc.), consider using the [AI for Templater](https://community.obsidian.md/plugins/ai-templater) plugin.

## Development

Install dependencies:

```bash
npm install
```

Run a development build with watch mode:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

## Release

Release tags must exactly match `manifest.json`'s `version` and must not use a leading `v`.

When a GitHub release is published, or when the release workflow is run manually, GitHub Actions builds the plugin and uploads these required release assets:

- `manifest.json`
- `main.js`
- `styles.css`

The workflow fails if any asset is missing or empty, or if the tag does not match the manifest version.

## References

- [Obsidian build a plugin guide](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin)
- [FreshRSS Google Reader-compatible API](https://freshrss.github.io/FreshRSS/en/developers/06_GoogleReader_API.html)
- [FreshRSS Fever API](https://freshrss.github.io/FreshRSS/en/developers/06_Fever_API.html)
- [Tiny Tiny RSS API reference](https://tt-rss.org/docs/API-Reference.html)
- [Inoreader stream IDs](https://www.inoreader.com/developers/stream-ids)
- [Feedly collect articles API](https://developers.feedly.com/reference/collect-articles)
- [Miniflux API reference](https://miniflux.app/docs/api.html)
- [Defuddle](https://github.com/kepano/defuddle)
