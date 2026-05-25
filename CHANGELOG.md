# Changelog
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
