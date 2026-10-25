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
           recordingYear, releaseYear, photo (JPEG data URL, at most ~170 KB), addedAt,
           works: [ { title, composer, tracks: [ { title, duration ("m:ss" or "h:mm:ss") } ] } ],
           catalogNo (catalogue or matrix number), barcode, manufacturer, madeIn, recordingVenue,
           spars ("DDD" | "ADD" | "AAD"), ifpiMastering, ifpiMould, notes,
           cardFields: [field keys, at most 6] (only when this disc chose its own) } ],
           // everything after addedAt is optional and only saved when filled in
  meta: { albums: [ { id, name, cdIds: [] } ],      // shown to users as "Favorites"
          settings: { lang, theme ("light" | "dark"; missing = match system), cardWidth (140–320 px), cardFields: [field keys, at most 6] } } }
          // older files may still have size ("comfortable"/"compact") and show_performers/show_publisher/show_years;
          // cardWidth() and cardFields() read those when the new keys are missing
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
- Settings → Display has a Theme switch: Match system (default), Light, Dark. It sets `data-theme` on `<html>`, and is also kept in localStorage (`cdc.theme`) so the page starts in the right theme before the collection loads.
- Card size is a continuous slider (1 px steps; cards resize live, the value saves on release). Cards are exactly that wide (`--card-w`, never wider than the shelf) rather than stretched to fill rows, so they don't jump when the column count changes; title, composer and spacing scale smoothly with the width.
- "Show on cards" lists every CD field (`CARD_FIELDS`), composer included; only the title always shows, and at most 6 more can be ticked (`CARD_FIELD_MAX`) so the shelf doesn't get crowded. Older settings without `cardFields` get composer plus their old ticks. The tick boxes stay folded behind a summary line and a "Change" button.
- The Settings choice is the default. Each CD's form has "Show on this card": a disc that never changes it follows the default (including later changes to it); once changed, it keeps its own `cardFields` until "Use the default" is pressed. Opening "Add a CD" always starts from the default, even after an unsaved form changed it.
- Catalogue number examples use the form "410 084-2" / "410 084-2 01".
- Composer sort uses the surname: the last word, or the text before a comma.
- A disc holds works, each with its own tracks; track numbers run on across the whole disc, as printed on back covers. A work's composer is optional; when the disc has no composer, cards show the works' composers.
- The form's fold-out "Disc details" section holds label, issuing corporation, both years, one "Catalogue / matrix number" field, manufacturer, country, venue, SPARS, barcode and IFPI codes. The profile shows them under the same heading.
- "Notes" is free text and is the last field of "Disc details", in the form and in the profile. It is written only in the edit form (no separate edit button in the profile).

## Roadmap

1. Get the first Windows build passing on GitHub Actions, then publish v0.1.0.
2. Code-sign the Windows installer to remove the SmartScreen warning.
3. Add a macOS job (`macos-latest`); signing and notarisation need an Apple Developer account.
4. Add accounts, sync and sharing through an online backend (Supabase or Firebase), as a new `Store`.
5. Build the phone apps with `tauri android init` and `tauri ios init`.
