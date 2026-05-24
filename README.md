# Starred News Sync

Import starred or saved RSS reader items into Obsidian as Markdown notes with YAML frontmatter.

## Features

- Adds a **Sync starred items now** command and ribbon action.
- Imports each item once using a stable filename based on article URL or reader item ID.
- Creates notes with YAML fields for title, URL, reader, feed, author, published date, import date, and tags.
- Supports manual sync and optional interval sync while Obsidian is open.
- Converts returned HTML summaries/content into Markdown and strips unsafe HTML elements and event attributes.

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
- **Automatic sync**: Runs sync on an interval while Obsidian is open.

Credentials are stored in this plugin's Obsidian data file. The plugin only sends network requests to the API URL you configure.

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

When a matching tag is pushed, or when the release workflow is run manually, GitHub Actions builds the plugin and uploads these required release assets:

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
