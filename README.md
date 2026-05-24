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

The release artifacts are `manifest.json`, `main.js`, and `styles.css` if CSS is kept.

## References

- [Obsidian build a plugin guide](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin)
- [FreshRSS Google Reader-compatible API](https://freshrss.github.io/FreshRSS/en/developers/06_GoogleReader_API.html)
- [FreshRSS Fever API](https://freshrss.github.io/FreshRSS/en/developers/06_Fever_API.html)
- [Tiny Tiny RSS API reference](https://tt-rss.org/docs/API-Reference.html)
- [Inoreader stream IDs](https://www.inoreader.com/developers/stream-ids)
- [Feedly collect articles API](https://developers.feedly.com/reference/collect-articles)
- [Miniflux API reference](https://miniflux.app/docs/api.html)


# Obsidian Sample Plugin

This is a sample plugin for Obsidian (https://obsidian.md).

This project uses TypeScript to provide type checking and documentation.
The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

This sample plugin demonstrates some of the basic functionality the plugin API can do.
- Adds a ribbon icon, which shows a Notice when clicked.
- Adds a command "Open modal (simple)" which opens a Modal.
- Adds a plugin setting tab to the settings page.
- Registers a global click event and output 'click' to the console.
- Registers a global interval which logs 'setInterval' to the console.

## First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code. 
- This project already has eslint preconfigured, you can invoke a check by running`npm run lint`
- Together with a custom eslint [plugin](https://github.com/obsidianmd/eslint-plugin) for Obsidan specific code guidelines.
- A GitHub action is preconfigured to automatically lint every commit on all branches.

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See https://docs.obsidian.md
