# Changelog
## 0.1.8 - 2026-05-25

- Added an optional startup sync setting that runs once after Obsidian opens.
- Added stable `rss_hash` duplicate detection so imported notes can be renamed without being imported again.
- Tightened article source fetching with streaming response size limits, request timeouts, and redirected URL validation.
- Documented Local Images Plus as an option for localizing remote article images.

## 0.1.7 - 2026-05-25

- Duplicate URL handling is now limited to checks to the output folder and its subfolders instead of the entire vault.

## 0.1.6 - 2026-05-25

- Added optional duplicate detection by comparing RSS item URLs with configurable YAML frontmatter fields.

## 0.1.5 - 2026-05-24

- Added optional note templates with Templater support and enhance note writing functionality

## 0.1.4 - 2026-05-24

- Added opt-in article source fetching with Defuddle extraction, URL validation, response size limits, final sanitization, and source metadata in note frontmatter.
- Fixed article Markdown formatting so nested paragraphs and headings keep block breaks instead of being collapsed inline.
- Added an opt-in setting to keep safe remote image links from fetched article pages.
- Added optional note templates with Templater support and addressable RSS item/content fields.

## 0.1.3 - 2026-05-24

- Changed imported note filenames to use the Obsidian-safe article title followed by ` - RSS ` and a short hash.
- Removed the redundant word "Obsidian" from the plugin manifest description for community plugin validation.
- Documented the imported note filename format in the README.
- Added a `lat.md` graph for plugin architecture, reader adapters, note writing, and release rules.
