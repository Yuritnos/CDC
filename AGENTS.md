# CDC project guidance

CDC is a Tauri 2 CD catalogue and audio player, shipping on Windows first. This is the single project instruction file for coding assistants. Read `STATUS.md` for the current handoff; consult source and focused tests for implementation details.

## Working rules

- Implement the requested scope; preserve existing data and behavior. Keep updates concise, inspect relevant code and run meaningful checks. Avoid duplicate testing or unnecessary parallel agents.
- Push, build, publish or change versions only when requested. An authorized Windows build normally includes committing/pushing to `Yuritnos/CDC` main, manually running `build-windows.yml`, and downloading `CDC-windows`. Verify both installers in staging before replacing `installers/nsis/` and `installers/msi/`. No tags/releases unless asked.
- Never put privileged Supabase keys, tokens or passwords in the app, source control or logs. Only the publishable key belongs in the app. Let the owner enter credentials; do not send their email to unrelated services. Ask before database drops or renames.
- Tests use isolated fixtures/mocked services, never the owner's collection/account. Keep this file stable and short. Update `STATUS.md` at milestones with results, pending work and limitations; replace stale entries rather than append a transcript.

## Code map and checks

- `src/index.html`: all HTML, CSS and plain JavaScript; no framework/bundler. `I18N` keys must exist in en/ja/zh; use `t()` and `data-i18n*`. Use theme tokens; support system/light/dark, keyboard access and reduced motion.
- `Store`/backend owns persistence; `Cloud` owns Supabase sync. Preserve Tauri, HTTP `/api/data` preview and conditional `window.claude` artifact paths.
- `src-tauri/src/lib.rs`: atomic saves, backups, cover/audio files and native commands. Data lives under the app data directory; retain the previous-save backup and newest 14 daily backups. Validate paths; cleanup must preserve referenced files and Undo/draft semantics.
- `src-tauri/tauri.conf.json`: identifier `com.cdc.collection`; keep `dragDropEnabled: false` so Windows permits internal dragging. Restrict asset access to the library's audio/covers folders.
- `.github/workflows/build-windows.yml`: Windows NSIS/MSI artifacts and generated `src/build.js`. Keep versions equal in `package.json`, `src-tauri/Cargo.toml` and Tauri config. Installers/build metadata are ignored.
- `supabase/README.md`, `schema.sql` and `migrations/`: account setup and server rules. A local migration file or UI placeholder does not prove hosted settings changed.
- Run `node tests/<relevant-test>.cjs`; broader coverage is `tests/collection-integration.cjs`. Focused suites cover lookup, performer roles/stress, work inheritance/form/tooltips, sections/rendering, audio drafts and unsaved forms. `npm run dev` starts Tauri; `npm run build` builds installers only when authorized. Bundled Node fallback: `%USERPROFILE%/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.

## Data and product invariants

- Document: `{cds, meta:{albums,playlists,order,settings}, sync:{metaAt,deleted,account}}`. Internally `albums` means Favorites (CD groups); playlists hold `{cdId,file}` tracks. Keep them separate. Preserve older optional fields, migrations and hidden `cd.set` through edits/import/export/sync.
- Only Title is required. Album composer/type/performers are defaults; blank work fields inherit independently via `workMetadata`. Manual work performers replace defaults; imported `performersMode: "additional"` adds extras. Store performers as `{role,name}` pairs; display a person once with combined roles. Role pickers use explicit buttons/checkbox panels, not native details/toggle layout loops.
- Works have optional composer/type/performers/duration and `tracks`. Number tracks across the disc. With zero tracks, duration belongs beside the work and audio gets a virtual slot; otherwise durations belong to tracks. Type/hub allow free text plus suggestions; clear hub is 胶圈 (accept legacy 透明圈). Label/issuer and recording/release years remain distinct; Notes ends Disc details.
- Album information starts open; Works/Audio folded. Work differences appear in an information popup that avoids the title. Changed-form closing offers Save/Discard/Keep editing; folding alone is not a change. Audio draft discard removes only newly copied files.
- Cards show Title plus at most six chosen fields; optional Favorites tags do not count (`-albums` hides them). CDs follow changing settings defaults until explicitly overridden. Card width is continuous, fixed per card rather than stretched.
- Sort: Custom order (default), Recently added, Composer surname A–Z, Title A–Z. Shelf reordering requires Alt+drag or Alt+arrows in Custom order with no search/filter. Queue/playlist reordering preserves the playing entry and grouped-disc boundaries. Keep short opening/closing and unfold/fold animations, reduced-motion support, and avoid replaying unfold animations on redraws.
- All CDs/Favorites cards open profiles. All music cards play/enqueue, with profile and playlist shortcuts. Hide Add a CD in All music; use Add music in playlists. Adjacent queue/playlist tracks from one CD group into a foldable disc with disc/track removal. Preserve Undo and delay destructive audio cleanup until it expires.
- Audio is copied locally, never uploaded; only metadata syncs. Missing files on another computer remain identifiable. Covers are content-addressed files locally, embedded pictures for sync/export. Editing preserves untouched audio/covers; cropping is shared with avatars.
- Discogs lookup matches barcode/catalogue/matrix; chosen results replace lookup-owned values, preserve user covers and save only on confirmation. Cover fallback: Rust Discogs download, then MusicBrainz/Cover Art Archive. Promote metadata shared by all works to album defaults; keep differences per work. Collapse a lone repeated-title track into work duration only; preserve distinct movements and multi-track works. `LOOKUP_SOURCES` remains the extension point.
- Local collection works offline. Sync uses newer CD timestamps and deletion markers; first sync must offer merge/remove-local/sign-out when local-only data exists. Keep unique User ID and separate nonunique nickname (20 characters), plus cropped avatar with C default. User ID changes mean a 30-day interval; deployment status belongs in `STATUS.md`.
