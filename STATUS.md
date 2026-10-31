# CDC current status

Updated: 2026-10-31 (Asia/Shanghai). Read `AGENTS.md` for project rules. This file is a compact handoff, not a changelog; verify git/build state before the next release task.

## Current milestone

- Multi-CD albums/box sets implemented: grouped shelf with a separate-disc toggle, shared metadata/cover defaults with explicit disc overrides, incomplete sets, disc subtitles, linking/detaching existing CDs, per-disc and whole-album deletion with Undo, selected/all-disc lookup import, album playback/queue/playlist shortcuts and whole-album or individual-disc Favorites selection.
- Each physical CD remains an independent record. `cd.set` stores stable release membership and materialized shared defaults; `set.cover` retains the main cover even when every disc has its own. Both disc and album covers use local content-addressed files and embedded pictures for sync/export. `meta.albums` still means Favorites. Existing optional CD/set fields, audio and untouched covers survive edits. Desktop release edits/imports/linking save as one document transaction and retain the draft after a failed save. Switching shared/disc editing preserves unsaved disc fields, performer rows and cover state. No database migration or version change (0.2.0).
- All 112 isolated checks across 11 suites passed: collection integration 27, role-picker stress 10 (Chrome/Edge), performer roles 10, unsaved form 8, lookup normalization 13, form sections 9, audio drafts 7, work inheritance 10, rendering 4, work tooltips 6, work forms 8. Updated older test expectations for current folded sections, short placeholders, performer ordering, Other hub and the restored set UI.
- Latest app source pushed to main: `6233e7d6f1fc1836a13d9ab34e07339f7a661ef0`. Windows build **26** succeeded: [Actions run 41202999197](https://github.com/Yuritnos/CDC/actions/runs/41202999197). The final `CDC-windows` archive's SHA-256 matched GitHub's artifact digest. Both installers passed archive extraction, x64 payload/product/version checks and executable comparison (only the expected Tauri bundle-type marker differs). Downloaded via the GitHub connector after intermittent direct-download connection resets; staging evidence is in `installers/staging-multicd-41202999197/verification.json`.
- Verified staging files replaced `installers/nsis/CDC_0.2.0_x64-setup.exe` (2,005,378 bytes) and `installers/msi/CDC_0.2.0_x64_en-US.msi` (2,695,168 bytes). Destination hashes match staging. No installation, tags or releases were performed. A subsequent STATUS-only commit records this handoff; the app build is from the source SHA above.
- Rollback retained locally in `installers/rollback-before-multicd-20261031/`: previous NSIS/MSI installers, source archive, project guidance/handoff, pre-change collection/previous-save snapshots, hashes and `ROLLBACK.md`. Source baseline is `409600c335449ea113a3be44648a203f5f69669b`; branch `codex/rollback-before-multicd-20261031` is also pushed to GitHub. Rollback hashes were reverified, and the owner's current collection file remains unchanged. Collection snapshots are private/ignored and must never be committed.
- Documentation consolidation is included with this milestone: stable short `AGENTS.md`, replacement `STATUS.md`, removal of duplicate `CLAUDE.md`.

## Awaiting confirmation / known limits

- User should retry multiple performer-role selection in the installed app. The picker was rebuilt and browser stress tests passed, but the original WebView2 `STATUS_BREAKPOINT` crash was not reproduced; installed-app resolution is not yet confirmed.
- Existing saved CDs are not silently rewritten by lookup fixes. Rerun the Liszt lookup (431 780-2) and save to apply corrected work-only durations.
- New multi-CD behavior has isolated browser coverage and successful native compilation/package checks; installed-app feedback is still needed. Installer verification did not launch CDC against the owner's collection.

## Unfinished account setup

These hosted changes remain unverified/unapplied after intermittent Supabase dashboard connectivity failures. Do not report them as complete or resume them without a relevant user request.

1. Apply `supabase/migrations/20261028_profile_handle_cooldown.sql` to project `ogpzmnaqybxybybooebi`: server-enforced 30 days (720 hours), timestamp/trigger and restrictive profile-delete policy. Verify the deployment using `supabase/README.md`.
2. Set hosted `mailer_otp_length` to 6 and verify both existing/new-user emails. The app shows a six-digit example but accepts 6–10 for compatibility; the project previously sent eight. Preserve SMTP and `{{ .Token }}` in both email templates.

## Next step

No implementation/build running. Await installed-app feedback or the next requested feature. Postponed work includes CD ripping, AI photo reading, phone sign-in, domain email, code signing, auto-update and additional platforms; none is authorized by this handoff.
