# CDC current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. This file is a compact handoff, not a changelog; verify git/build state before the next release task.

## Current milestone

- Revised multi-disc editor implemented: no manual Disc number or Disc subtitle inputs. Add a disc creates an automatically numbered independent draft; disc buttons switch between each disc's Disc information, Works, Disc details and Audio. Existing albums load their member discs into the same editor. Save all discs validates every included draft before one desktop document transaction; failed saves keep all drafts. Removing/discarding new drafts cleans only newly copied audio, including inactive drafts. Existing subtitle/extension metadata and original audio/covers survive edits.
- Lookup autofill creates separate disc drafts, promotes composer/type/performer defaults independently per disc, and preserves edits/audio when switching. Selected-disc import controls now select the drafts to save. New album defaults contain only metadata common to the saved discs; differences remain explicit per-disc overrides. Pending native audio imports lock switching and cannot be overwritten by late lookup details. Shared album editing remains optional.
- Previous profile adjustment is included: Link existing CDs, Play album, Enqueue album and Add album to playlist appear only through All music. Edit album information, Add another disc, Add to favorites and Delete whole album share the final footer. Grouped browsing, incomplete sets, Favorites, playlists and removal with Undo remain supported.
- All 116 isolated checks across 11 suites passed: collection integration 31, role-picker stress 10 (Chrome/Edge), performer roles 10, unsaved form 8, lookup normalization 13, form sections 9, audio drafts 7, work inheritance 10, rendering 4, work tooltips 6, work forms 8. Tooltip geometry fixtures now wait for viewport/scroll settling and a fresh pointer entry before checking hover; production tooltip logic is unchanged. Source HTML SHA-256: `1c5cb59a55941523d8c86d651300fc57c034524787f361e179de716acdd4bb95`.
- Latest app source pushed to main: `933b3c6c58214a1c83f5913fd25e2b245af27046`. Windows build **27** succeeded: [Actions run 41218138600](https://github.com/Yuritnos/CDC/actions/runs/41218138600). Downloaded `CDC-windows` through the GitHub connector; archive SHA-256 `bfac1faf235ce2f03cb6e6dded9669f1c8673debdb875a60e86687dc18e6b5c6` matches GitHub's artifact digest. Both installers passed archive extraction, x64 product/version checks and payload comparison (only Tauri's expected package-type marker differs). Evidence: `installers/staging-disc-editor-41218138600/verification.json`.
- Verified staging files replaced `installers/nsis/CDC_0.2.0_x64-setup.exe` (2,008,739 bytes) and `installers/msi/CDC_0.2.0_x64_en-US.msi` (2,699,264 bytes); destination hashes match staging. Version remains 0.2.0; About identifies build 27. No database migration, application installation, tags or releases performed. A subsequent STATUS-only commit records this handoff; the app build is from the source SHA above.
- Build-26 rollback saved in `installers/rollback-before-disc-editor-20261101/`: both installers, source archive (app commit `6233e7d6f1fc1836a13d9ab34e07339f7a661ef0`), hashes, `ROLLBACK.md` and private collection/previous-save snapshots. Pushed branch `codex/rollback-before-disc-editor-20261101` retains the prior main head. The pre-multi-CD rollback also remains in `installers/rollback-before-multicd-20261031/` and pushed branch `codex/rollback-before-multicd-20261031` (baseline `409600c335449ea113a3be44648a203f5f69669b`). Both rollback hash manifests were reverified; the owner's current collection file remains unchanged. Collection snapshots are ignored/private and must never be committed.

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
