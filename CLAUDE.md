# CDC: project notes for Claude

CDC is an app for cataloguing the CDs a person owns. It started as a single-page web artifact in a claude.ai chat and is now a Tauri 2 desktop app. Windows ships first; macOS, iPhone and Android follow later. Sharing and networking come after that.

## Layout

- `src/index.html`: the whole UI in one file, with inline CSS and plain JavaScript. There is no framework and no bundler.
  - Translations live in the `I18N` object (`en`, `ja`, `zh`). Every key must exist in all three. Use `t(key, vars)` for text; static HTML uses `data-i18n`, `data-i18n-ph` and `data-i18n-aria`.
  - Colours are tokens on `:root` with dark-mode overrides. Keep both themes working.
  - **Storage layer:** `Store` has `load()` and `save(doc)`. In Tauri it calls the Rust commands, and otherwise a `/api/data` HTTP endpoint. All persistence goes through it, and future online sync should be another `Store`, not changes elsewhere.
  - The page also still runs as a claude.ai artifact, using `window.claude.use("db")` and related calls. That path is only used when `window.claude` exists.
- `src-tauri/src/lib.rs`: the `load_data` and `save_data` commands.
  - The collection is saved to `<app data dir>/collection.json`, with a backup kept as `collection.backup.json` (before the last save).
  - The day's first save also copies the old file to `backups/collection-YYYY-MM-DD.json` (UTC date; the newest 14 are kept). `list_backups` / `read_backup` serve Settings → "Go back to a backup".
  - Covers are files in `covers/` named after their content (`<fnv64>-<bytes>.jpg|png|webp`): `save_cover` (data URL → name), `cover_data` (name → data URL), `covers_root_dir`, `tidy_covers` (on start, deletes files no collection or backup mentions; does nothing if collection.json can't be read).
  - `open_releases` opens the fixed GitHub releases page in the browser.
  - Saves are atomic: the file is written to a temporary file first, then renamed.
  - On first run, data from the old trial is migrated from `%APPDATA%\CDC\collection.json`.
- `src-tauri/tauri.conf.json`: the identifier is `com.cdc.collection`. The main window has `dragDropEnabled: false`: Tauri's own file-drop handling on Windows otherwise blocks dragging inside the page (cards and rows showed a "no" cursor). The installers are NSIS (current user, with English, Simplified Chinese and Japanese) and MSI.
- `.github/workflows/build-windows.yml`: builds on `windows-latest` with `tauri-apps/tauri-action`. A manual run uploads the installers as artifacts; a `v*` tag also creates a draft release. It writes `src/build.js` (`window.CDC_BUILD = { run, commit, date }`, git-ignored) so Settings → About shows the build number.
- Version: 0.2.0 in `tauri.conf.json`, `Cargo.toml` and `package.json` (keep all three equal). "Check for a new version" compares with the newest *published* GitHub release (`api.github.com/.../releases/latest`); real auto-update (tauri-plugin-updater) would need a signing key pair stored as a GitHub secret by the owner.

## Data shape

```
{ cds: [ { id, title, composer, performers: [{ role, name }], label, issuer,
           recordingYear, releaseYear, photo (JPEG data URL, at most ~170 KB) or, in the desktop file, photoFile (a file in covers/),
           addedAt, updatedAt (desktop, for sync),
           works: [ { title, composer, tracks: [ { title, duration ("m:ss" or "h:mm:ss") } ] } ],
           catalogNo (catalogue or matrix number), barcode, manufacturer, madeIn, recordingVenue,
           spars ("DDD" | "ADD" | "AAD"), ifpiMastering, ifpiMould, notes,
           cardFields: [field keys, at most 6, plus "-albums" when favorites tags are off] (only when this disc chose its own) } ],
           // everything after addedAt is optional and only saved when filled in
  meta: { albums: [ { id, name, cdIds: [] } ],      // shown to users as "Favorites"
          playlists: [ { id, name, items: [ { cdId, file } ] } ],   // saved playlists of tracks (desktop audio)
          order: { all: [cdIds], music: [cdIds] },   // "Custom order" of All CDs and All music; a favorite's order is its cdIds
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
- Adding and editing happen in a floating window, opened by the "+ Add a CD" button at the bottom right. The form calls the image "Cover". That button (`open-add`, `renderFab`) is hidden in All music, and in a playlist view it becomes "+ Add music".
- Clicking a card opens the CD profile window, which holds Edit, Remove and "Add to favorites". Cards have no action buttons.
- "Add to favorites" opens a list of favorites to toggle, plus a field to create a new favorite.
- The left column (about 188 px) holds "All CDs", then a collapsible "Favorites" section, with the Settings button at the bottom.
- The account sits at the top right as a popover. Settings holds language, card size, which details show on cards, and exports.
- Settings → Display has a Theme switch: Match system (default), Light, Dark. It sets `data-theme` on `<html>`, and is also kept in localStorage (`cdc.theme`) so the page starts in the right theme before the collection loads.
- Card size is a continuous slider (1 px steps; cards resize live, the value saves on release). Cards are exactly that wide (`--card-w`, never wider than the shelf) rather than stretched to fill rows, so they don't jump when the column count changes; title, composer and spacing scale smoothly with the width.
- "Show on cards" lists every CD field (`CARD_FIELDS`), composer included; only the title always shows, and at most 6 more can be ticked (`CARD_FIELD_MAX`) so the shelf doesn't get crowded. Older settings without `cardFields` get composer plus their old ticks. The tick boxes stay folded behind a summary line and a "Change" button. The favorites a disc is in (tags at the bottom of the card) have their own tick, "Favorites it's in (not counted)": on unless turned off, not counted toward the 6, stored as `"-albums"` (`FAV_TAGS_OFF`) in the same list so older lists keep showing the tags.
- The Settings choice is the default. Each CD's form has "Show on this card": a disc that never changes it follows the default (including later changes to it); once changed, it keeps its own `cardFields` until "Use the default" is pressed. Opening "Add a CD" always starts from the default, even after an unsaved form changed it.
- Catalogue number examples use the form "410 084-2" / "410 084-2 01".
- Composer sort uses the surname: the last word, or the text before a comma.
- Sort options: Custom order (default), Recently added, Composer A–Z, Title A–Z (release year was removed by the owner). Saved per computer in localStorage `cdc.sort`. Only in Custom order, and not while searching, can cards be moved with Alt + drag or Alt + arrow keys in All CDs, a favorite and All music (`moveCard`, `orderOf`; the grid gets class `arranging`). CDs not placed yet come first, newest first.
- Dragging rows (`dragRows`, `rowBlock`) works in playlist views and the play queue (`moveQueue` keeps the current track current), with the same rules as the ↑/↓ buttons: discs and lone tracks move past whole rows, an unfolded disc's tracks only within it.
- Shelf tools (all from the owner's 16-item round, 2026-10-26/27):
  - Windows and popovers open with a short animation (`ov-in`/`panel-in`/`pop-in`); modal windows close with a short fade and settle (`ov-out`/`panel-out`). Expandable panels and custom Sort/Language menus use brief open and close animations (`unfold-in`/`unfold-out`). All animations are off for reduced motion.
  - `renderGrid()` wraps `drawGrid()` and gives keyboard focus back to the same id after redrawing.
  - Filters (`filters`, `renderFilters`): composer (disc's or a work's), performer, label, decade (release year, else recording year). Not saved. Names in the CD profile and in Statistics are `nameLink`s → `showFiltered`. Dragging is off while a search or filter is active.
  - View switch: cards or a list table (`viewMode`, localStorage `cdc.view`, `listTable`/`listRow`); list rows drag like cards.
  - "Select" (`selecting`, `selected`, `#selbar`): tick CDs, then add them to a favorite (or a new one, seeded via `openAlbumDlg(..., "favorite", ids)`), or remove them.
  - Removing CDs (`removeCds`) offers Undo in the toast for `UNDO_MS` (desktop `backend.restore`; favorites, playlists and custom orders are put back; audio copies are deleted only after Undo expires).
  - Adding a CD whose barcode or catalogue number is already in the collection warns once (`sameDisc`, `#dup-warn`); the button becomes "Add anyway".
  - Favorites and playlists in the left column can be dragged or moved with Alt + ↑/↓ (`moveChip`).
  - Statistics window (`win-stats`, `renderStats`): tiles (CDs, works, tracks, total time, favorites, CDs with audio) and bars for top composers, labels, release decades and CDs added per year.
  - Settings → Your data: "Import a CDC file (JSON)" (add to the collection or replace it; `backend.importDoc`, `mergeLists`) and "Go back to a backup" (replaces the collection). Export now includes playlists, orders and cover pictures. Settings → About CDC: version, build, update check.
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
- Profile (signed-in only): table `profiles` with `handle` (the "User ID", each person's unique code: 3–20 letters, digits or underscores, unique ignoring case via an index on `lower(handle)`, so a clash returns 409 → "taken"), `nickname` (what others see, next to the photo: up to 20 characters in any language, not unique) and `avatar` (a 256 px round-cropped JPEG data URL, under 200 KB). Owner's rule: keep both the user ID and the nickname. Edited in the profile window (`openProfile`). Cached in localStorage (`cdc.profile`) for the top-right corner, which shows the photo (or initial) and the nickname (or user ID, or email).
- Cropping (`makeCropper`) is shared by the profile photo (round frame) and CD covers (square frame in the CD form): drag to move, zoom by slider, mouse wheel or +/−, arrow keys move. Only the framed part is saved. A chosen cover file is cropped from its full-size original; covers are only re-encoded when the frame was moved or zoomed (`coverForSaving`, at most ~170 KB). Signed out in the desktop app, the corner shows just "User" (ユーザー / 用户) with the ♪ placeholder, never the Windows user name. The user ID example is "user_id".
- Tested on 2026-10-25 with two local stand-ins for the desktop app (a PowerShell server serving `src/index.html` with `window.CDC_DESKTOP = true` and `/api/data` backed by a JSON file, on two ports so each has its own localStorage): first-sign-in merge, add/edit/remove both ways, newer-edit-wins, sign-out keeps the collection. Not yet tried in the installed Tauri app.

## Audio

- Owner's choices: people add their own audio files per CD; CDC **copies** them into its library on this computer (`<app data dir>/audio/<CD id>/`). Audio is not uploaded to the account (Supabase free storage is 1 GB for the whole project); only the list syncs, so other computers show those files as "on another computer". Reading or ripping a CD from a drive was discussed and postponed.
- `cd.audio`: `[{ file ("<CD id>/<file name>" inside the library), name (original file name), size, track (disc track number, 0 = none) }]`. New files are assigned to free tracks in file-name order; each file has a track menu (choosing a taken track swaps).
- Rust (`lib.rs`): `audio_root_dir`, `add_audio` (native file picker via tauri-plugin-dialog, then copy), `audio_present`, `remove_audio`, `remove_cd_audio`. Every library path is checked to stay inside the audio folder. The page plays files through the asset protocol (`convertFileSrc`), enabled in `tauri.conf.json` for `$APPDATA/audio/**` only (Cargo feature `protocol-asset`).
- Page: the CD profile's "Audio" section (`audioSection`) and the bottom player bar. File names show only where needed (a file with no track, or one on another computer).
- Play queue (code: `player.queue`, panel `pl-list`, shown to users as "Play queue"): one queue across CDs, entries `{ cdId, file }`, remembered on this computer (localStorage `cdc.playlist`, restored paused). Playing a CD from its profile or from **All music** adds its tracks to the queue if missing and plays the chosen one; it continues to the next and keeps playing while browsing. The bar shows the track title (or the CD title when the file has no track) over the CD title; media keys via `mediaSession`. The bar's queue button (no close button) opens a panel to jump to or remove entries, "Save as playlist" or "Clear queue".
- Left column (owner chose "scheme A"): a **Library** section (All CDs, Favorites = groups of discs) and, in the desktop app, a **Music** section: "♪ All music" (`currentAlbum === "music"`, the CDs with audio here; clicking a card plays it; at the bottom right of each cover, an ⓘ button opens the CD profile and a playlist button opens the playlist menu) and **Playlists** (`currentAlbum === "pl:<id>"`, foldable like Favorites). Favorites and playlists are kept separate on purpose.
- Saved playlists (`meta.playlists`, synced with favorites; merged on a computer's first sync): named lists of tracks across CDs. The playlist view (`playlistView`) replaces the grid: ▶ Play (replaces the queue with its tracks that have audio here), ▶ per track to start there, ↑/↓ to reorder, × to remove. Tracks come from "Save as playlist" (the queue), "+ Playlist" on a track in a CD's Audio section, "+ Add music" (bottom right in a playlist view; window `win-addmusic`, `renderAddMusic`: All music's discs with a search, each foldable to its tracks, with a round +/✓ button per disc and per track that appends to the playlist or takes out again), or the playlist button on each card in All music (a floating menu, `cardPl`: a ticked playlist already holds all the disc's tracks and clicking it takes them out; otherwise clicking adds the missing ones; or "+ New playlist with this disc").
- Disc rows (owner's request): in the play queue and in a playlist view, neighbouring tracks from the same CD (`discRuns`) show as one disc row with its cover, a fold button that unfolds its tracks (`openRuns`, not saved), and × to remove the whole disc; unfolded tracks each have their own ×. A lone track stays a plain row. In a playlist, ↑/↓ on a disc or lone track moves it past whole rows; an unfolded disc's tracks move only within it. Clicking the disc that is playing pauses/resumes; another disc plays from its first track. New/rename/delete use the favorites window with kind "playlist". Removing a CD or audio file prunes it from playlists.
- Player extras: shuffle (plays each queue entry once per round, Previous walks back through `player.history`), repeat off/all/one, mute and volume (hidden under 640 px), saved in localStorage `cdc.playmode`. Shortcuts with no window open: Space play/pause, Ctrl+F search, Ctrl+N add a CD (or music).
- Track lengths: a track with no length takes its audio file's length (`fillDurations`, once per CD per session, and after files are added or moved).
- Covers in the desktop app (`Covers`, `coverSrc`, `withCoverData`): shown from `covers/` through the asset protocol (scope `$APPDATA/covers/**`); new covers stay data URLs until `storeCovers` writes them on save (updatedAt unchanged). Older files are converted on start. Sync pushes and exports carry the picture itself. Editing a CD whose cover is a file loads it back with `cover_data` for the cropper; an untouched cover keeps its file (`editCover`).
- Editing a CD keeps `audio`; removing a CD (here, or on another computer via sync) deletes its copies and takes it off the playlist.

## Album defaults and work overrides

- Feedback round 2-2 (2026-10-30): the form calls the required field "Title". Composer, "Type of work" (`cd.type`) and performers are grouped as album-wide defaults before the works.
- Work details start folded. Optional `work.composer`, `work.type` and `work.performers` override the corresponding album field independently; blank values inherit without copying defaults into the work. Work performer rows use the same multiple/custom role controls as album performers.
- Profiles and shelf cards show an information icon before a work title only when its metadata differs from album defaults. Hover, focus or click opens its popup; it stays within the card boundary and avoids covering the title. The album type appears below the composer, above the performers. Work-specific performers participate in search and filters.
- Feedback 2.3: Album information starts open; Works and Audio start folded. Summaries include their guidance in parentheses. Closing a changed CD form asks whether to save, discard or keep editing. Fold states alone are not changes.
- Lookup promotes composer/type to album defaults only when all works agree. Common performer credits belong to the album; other credits belong to their works. Imported performer extras use `performersMode: "additional"` so effective work performers include album defaults without duplicating stored credits. Manually entered work performer lists still replace defaults.
- Feedback 2.4: the performer role picker uses a button and a plain checkbox panel rather than native details/toggle positioning. Lookup collapses a single track into `work.duration` only when the track repeats its work title; a distinct movement title remains a track. Summary hints inherit the heading font size, and composer/type/hub placeholders use examples without optional markers.
- Set controls and set displays are temporarily removed. Editing preserves existing `cd.set`; imports, exports, backups and sync keep it. Online multi-disc lookup still selects an individual disc without creating new set links.
- Chinese clear-hub wording is "胶圈"; the old "透明圈" text remains accepted when reading existing data.
- Audio file management is in the CD form beside Disc details. A profile with no audio has no Audio section. Audio changes are drafts until saved; newly copied draft files are cleaned up on discard.

## Roadmap

1. Get the first Windows build passing on GitHub Actions, then publish v0.1.0.
2. Code-sign the Windows installer to remove the SmartScreen warning.
3. Add a macOS job (`macos-latest`); signing and notarisation need an Apple Developer account.
4. Add accounts, sync and sharing through an online backend (Supabase or Firebase), as a new `Store`.
5. Build the phone apps with `tauri android init` and `tauri ios init`.
