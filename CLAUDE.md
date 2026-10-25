# CDC: project notes for Claude

CDC is an app for cataloguing the CDs a person owns. It started as a single-page web artifact in a claude.ai chat and is now a Tauri 2 desktop app. Windows ships first; macOS, iPhone and Android follow later. Sharing and networking come after that.

## Layout

- `src/index.html`: the whole UI in one file, with inline CSS and plain JavaScript. There is no framework and no bundler.
  - Translations live in the `I18N` object (`en`, `ja`, `zh`). Every key must exist in all three. Use `t(key, vars)` for text; static HTML uses `data-i18n`, `data-i18n-ph` and `data-i18n-aria`.
  - Colours are tokens on `:root` with dark-mode overrides. Keep both themes working.
  - **Storage layer:** `Store` has `load()` and `save(doc)`. In Tauri it calls the Rust commands, and otherwise a `/api/data` HTTP endpoint. All persistence goes through it, and future online sync should be another `Store`, not changes elsewhere.
  - The page also still runs as a claude.ai artifact, using `window.claude.use("db")` and related calls. That path is only used when `window.claude` exists.
- `src-tauri/src/lib.rs`: the `load_data` and `save_data` commands.
  - The collection is saved to `<app data dir>/collection.json`, with a backup kept as `collection.backup.json`.
  - Saves are atomic: the file is written to a temporary file first, then renamed.
  - On first run, data from the old trial is migrated from `%APPDATA%\CDC\collection.json`.
- `src-tauri/tauri.conf.json`: the identifier is `com.cdc.collection`. The installers are NSIS (current user, with English, Simplified Chinese and Japanese) and MSI.
- `.github/workflows/build-windows.yml`: builds on `windows-latest` with `tauri-apps/tauri-action`. A manual run uploads the installers as artifacts; a `v*` tag also creates a draft release.

## Data shape

```
{ cds: [ { id, title, composer, performers: [{ role, name }], label, issuer,
           recordingYear, releaseYear, photo (JPEG data URL, at most ~170 KB), addedAt } ],
  meta: { albums: [ { id, name, cdIds: [] } ],      // shown to users as "Favorites"
          settings: { lang, size, show_performers, show_publisher, show_years } } }
```

Internally, favorites are still called `albums`, in code, ids and translation keys. Users only ever see "Favorites" (お気に入り / 收藏夹).

## Decisions the owner has made (keep these)

- Title is the only required field. Composer is optional.
- There are two separate years: recording year (1900 or later) and CD release year (1980 or later).
- The form has an "Issuing corporation" field, separate from "Label".
- Adding and editing happen in a floating window, opened by the "+ Add a CD" button at the bottom right. The form calls the image "Cover".
- Clicking a card opens the CD profile window, which holds Edit, Remove and "Add to favorites". Cards have no action buttons.
- "Add to favorites" opens a list of favorites to toggle, plus a field to create a new favorite.
- The left column (about 188 px) holds "All CDs", then a collapsible "Favorites" section, with the Settings button at the bottom.
- The account sits at the top right as a popover. Settings holds language, card size, which details show on cards, and exports.
- Composer sort uses the surname: the last word, or the text before a comma.

## Roadmap

1. Get the first Windows build passing on GitHub Actions, then publish v0.1.0.
2. Code-sign the Windows installer to remove the SmartScreen warning.
3. Add a macOS job (`macos-latest`); signing and notarisation need an Apple Developer account.
4. Add accounts, sync and sharing through an online backend (Supabase or Firebase), as a new `Store`.
5. Build the phone apps with `tauri android init` and `tauri ios init`.
