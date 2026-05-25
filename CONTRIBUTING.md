# Contributing to Starred News Sync

Thank you for considering a contribution. Starred News Sync is an Obsidian community plugin for importing starred or saved RSS reader items as Markdown notes with YAML frontmatter. Contributions are welcome when they keep the plugin small, privacy-conscious, and reliable across supported reader APIs.

## Ways to contribute

- Report bugs with enough detail to reproduce the problem.
- Request features that fit the plugin scope: importing saved RSS reader items, note formatting, templates, duplicate detection, and release quality.
- Improve documentation, examples, compatibility notes, or troubleshooting guidance.
- Submit focused pull requests for bug fixes, reader compatibility, settings validation, tests, or maintenance work.

## Before opening an issue

Please check the README, existing issues, and recent releases first.

For bug reports, include:

- Plugin version.
- Obsidian version and operating system.
- Reader provider and API type, for example FreshRSS Google Reader-compatible API, Fever, Tiny Tiny RSS, Inoreader, Feedly, or Miniflux.
- Relevant settings, with credentials removed.
- Steps to reproduce.
- Expected result and actual result.
- Console errors or sync notices, if available.

Do not post API tokens, passwords, private feed URLs, vault contents, or full imported articles in public issues.

## Development setup

This project uses npm and esbuild.

```bash
npm install
npm run dev
```

Use `npm run dev` while developing. It runs esbuild in watch mode and updates the bundled `main.js` locally.

For a production check, run:

```bash
npm run build
npm run lint
lat check
```

`main.js` is a generated build artifact and should not be committed.

## Manual testing in Obsidian

Build the plugin, then copy these files to a test vault:

```text
<Vault>/.obsidian/plugins/starred-news-sync/
  manifest.json
  main.js
  styles.css
```

Reload Obsidian and enable the plugin in **Settings -> Community plugins**. Test with a throwaway vault whenever a change writes notes, scans note frontmatter, fetches article source pages, or changes settings.

## Code guidelines

- Keep `src/main.ts` focused on plugin lifecycle and delegate feature logic to modules in `src/`.
- Prefer small, focused files with clear boundaries.
- Use TypeScript types rather than broad `any`.
- Keep startup light; defer network requests and expensive scans until sync time.
- Use Obsidian APIs and lifecycle helpers, including `registerEvent`, `registerDomEvent`, and `registerInterval`, when cleanup is needed.
- Keep UI strings short and sentence case.
- Avoid large dependencies. Any new dependency must be browser-compatible and bundled into `main.js`.
- Do not introduce Node or Electron APIs unless the plugin is intentionally made desktop-only.

## Privacy and security

The plugin should remain local-first and transparent.

- Make network requests only when required for the import feature or explicit user settings.
- Document every external service contacted and the data sent.
- Never add hidden telemetry.
- Never fetch and execute remote code.
- Do not read or enumerate unrelated vault files. File access should stay scoped to the feature being used, such as the configured output folder.
- Treat reader credentials, tokens, feed URLs, imported article text, and vault filenames as sensitive.
- Validate and sanitize remote HTML before writing it to notes.

## Reader compatibility

Reader APIs use different terms and data shapes. When adding or changing a reader adapter:

- Normalize output into the shared `StarredNewsItem` shape.
- Preserve stable item IDs and canonical URLs when available.
- Handle missing optional fields gracefully.
- Avoid assuming that labels, tags, saved state, read state, or folders mean the same thing across providers.
- Document provider-specific behavior in the README when users need setup guidance.

## Templates and note output

Changes to note writing should preserve existing imported notes when possible.

- Keep command IDs and settings keys stable after release.
- Keep filename generation stable unless the change is intentional and documented.
- Preserve YAML frontmatter compatibility.
- If adding template fields, expose them through the `rss` context and document them.
- Avoid moving or renaming notes during import unless explicitly requested by the user.

## Pull request checklist

Before opening a pull request:

- Run `npm run build`.
- Run `npm run lint`.
- Run `lat check`.
- Update `README.md` for user-facing behavior changes.
- Update `CHANGELOG.md` for notable changes.
- Update `lat.md/architecture.md` when module boundaries or workflows change.
- Keep the pull request focused on one issue or feature.
- Explain the behavior change and any privacy, compatibility, or migration implications.

## Release notes

Maintainers prepare releases by bumping `manifest.json`, `package.json`, `package-lock.json`, and `versions.json` consistently. Release tags must exactly match `manifest.json`'s version and must not use a leading `v`.

The GitHub release workflow builds and uploads these release assets:

- `manifest.json`
- `main.js`
- `styles.css`

Do not attach extra runtime files unless the plugin loading model is intentionally changed.

## License

By contributing, you agree that your contribution is provided under the repository license.
