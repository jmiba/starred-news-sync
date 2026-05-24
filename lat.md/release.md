# Release Process

Releases must build the bundled plugin and publish the exact files required by the community plugin loader.

## Version files

Plugin releases keep `manifest.json`, `package.json`, `package-lock.json`, and `versions.json` in sync with the same semantic version.

The version bump helper is `version-bump.mjs`. The release workflow verifies that the GitHub release tag exactly matches the manifest version before uploading assets.

## Release assets

Each release must attach `manifest.json`, `main.js`, and `styles.css` as separate assets.

The release automation is `.github/workflows/release.yml`. It runs the production build, verifies required assets are present and non-empty, then creates or updates release attachments.

## Validation checks

Automated checks should run TypeScript build validation and the Obsidian ESLint rules before release assets are trusted.

The CI workflow is `.github/workflows/lint.yml`. Local verification should include `npm run build`, `npm run lint`, and `lat check` when the graph changes.
