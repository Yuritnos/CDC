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
           recordingYear, releaseYear, photo (JPEG data URL, at most ~170 KB), addedAt, updatedAt (desktop, for sync),
           works: [ { title, composer, tracks: [ { title, duration ("m:ss" or "h:mm:ss") } ] } ],
           catalogNo (catalogue or matrix number), barcode, manufacturer, madeIn, recordingVenue,
           spars ("DDD" | "ADD" | "AAD"), ifpiMastering, ifpiMould, notes,
           cardFields: [field keys, at most 6] (only when this disc chose its own) } ],
           // everything after addedAt is optional and only saved when filled in
  meta: { albums: [ { id, name, cdIds: [] } ],      // shown to users as "Favorites"
          settings: { lang, theme ("light" | "dark"; missing = match system), cardWidth (140–320 px), cardFields: [field keys, at most 6] } } }
          // older files may still have size ("comfortable"/"compact") and show_performers/show_publisher/show_years;
          // cardWidth() and cardFields() read those when the new keys are missing
  sync: { metaAt, deleted: { cdId: removedAtMs }, account: userId last synced with } }   // desktop file only; see "Accounts and sync"
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

## Finding a CD online

- The top of the CD form has "Find this CD online": type, or scan from a photo or the camera, a barcode, catalogue number or matrix, pick a release, and its details **replace** what is in the form (highlighted with `.filled` until edited). A field the release lacks is emptied if an earlier lookup filled it, but kept if the user typed it. The result list stays open so another release can be chosen. Nothing is saved until the CD is added.
- Source: Discogs (`discogsSource`), called directly from the page without a key (`api.discogs.com` allows it, about 25 requests a minute). Its loose search results are filtered so only releases whose catalogue number, barcode or matrix really match are shown.
- Performer roles come from Discogs credits on the release **and** on single tracks/works. When a release only lists names, orchestras and choirs are recognised by name (several languages, `ORCHESTRA_NAME`/`CHOIR_NAME`) and a person listed right after an orchestra is taken as its conductor.
- Covers (`findCover`), best first: (1) in the desktop app, the release's own Discogs picture, downloaded by the Rust command `fetch_cover` (reqwest; only `https://i.discogs.com` / `img.discogs.com`, at most 5 MB) because Discogs doesn't let web pages load its pictures; (2) the Cover Art Archive via MusicBrainz: the release by barcode/catalogue number, then any edition of the same release group, then a title + artist search. Tested coverage of (2) alone on classical CDs was poor (about 2 in 12), which is why (1) exists. A cover the user chose is never replaced; one from an earlier lookup is.
- `LOOKUP_SOURCES` is the extension point: a source has `search(q)` → candidates and `details(item, q)` → CD fields in CDC's shape. Planned later: an AI source that reads the cover photo, and MusicBrainz as another database.
- Barcodes are read by our own EAN-13/UPC-A reader (`readBarcode`), because Windows browsers have no `BarcodeDetector`. It scans lines across and down in both directions with two edge finders (local-average threshold and peak/dip) and votes on check-digit-valid results.

## Accounts and sync

- Supabase, chosen by the owner (free tier, reachable from mainland China). Setup steps for the project owner: `supabase/README.md`; tables and row-level security: `supabase/schema.sql` (`cds`: one row per CD, `meta`: favorites and settings, `profiles`: user ID and photo). All three have been run in the owner's project `ogpzmnaqybxybybooebi`.
- `SUPABASE_URL` and `SUPABASE_KEY` (the public anon key) are constants near `Cloud` in `src/index.html`. While either is empty, accounts are hidden. Never put the service_role key in the app.
- Sign-in is a code sent by email (`/auth/v1/otp`, then `/auth/v1/verify` with `type: "email"`). The project sends 8 digits (Supabase's current default); the app accepts 6–10. Both the "Magic link or OTP" and the "Confirm sign up" email templates must contain `{{ .Token }}` (first-time users get the latter); editing templates needs custom SMTP (Gmail `cdcshelf.login@gmail.com` for now, a domain-based sender before launch). Phone sign-in is planned for later (needs a paid SMS provider). The session is kept in localStorage (`cdc.session`) and renewed with the refresh token.
- Desktop only. The collection file stays the working copy, so the app works offline. `Cloud` talks to Supabase with plain `fetch` (no supabase-js). Each CD carries `updatedAt`; the file's `sync` object holds `metaAt` and `deleted` (removal markers until the account has them). Sync runs on start, about 1.5 s after a change, every 5 minutes, and on focus/online. Per CD the newer copy wins; a removal wins over an older edit. After that, the newer favorites/settings win.
- First sync of a computer with an account (`sync.account` differs): if the computer has CDs or favorites the account doesn't, the owner's rule is to **ask** (`askFirstSync`, window `win-firstsync`): "Add them to my account" (merge; favorites merged from both sides), "Remove them from this computer" (with a confirm step, since it can't be undone; the computer then takes the account's collection and favorites as they are), or "Sign out instead" (also what closing the window does; nothing changes and the question comes back at the next sign-in). With nothing new on the computer, it syncs without asking.
- Profile (signed-in only): table `profiles` with `handle` (the "User ID": 3–20 letters, digits or underscores, unique ignoring case via an index on `lower(handle)`, so a clash returns 409 → "taken") and `avatar` (a 256 px round-cropped JPEG data URL, under 200 KB). Edited in the profile window (`openProfile`): the photo is positioned in a circle by dragging, zoomed by slider, mouse wheel or +/−, and moved with the arrow keys; only the circle is saved. Cached in localStorage (`cdc.profile`) for the top-right corner, which shows the photo (or initial) and the user ID (or email).
- Tested on 2026-10-25 with two local stand-ins for the desktop app (a PowerShell server serving `src/index.html` with `window.CDC_DESKTOP = true` and `/api/data` backed by a JSON file, on two ports so each has its own localStorage): first-sign-in merge, add/edit/remove both ways, newer-edit-wins, sign-out keeps the collection. Not yet tried in the installed Tauri app.

## Roadmap

1. Get the first Windows build passing on GitHub Actions, then publish v0.1.0.
2. Code-sign the Windows installer to remove the SmartScreen warning.
3. Add a macOS job (`macos-latest`); signing and notarisation need an Apple Developer account.
4. Add accounts, sync and sharing through an online backend (Supabase or Firebase), as a new `Store`.
5. Build the phone apps with `tauri android init` and `tauri ios init`.
