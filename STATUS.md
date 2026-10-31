# CDC current status

Updated: 2026-10-31 (Asia/Shanghai). Read `AGENTS.md` for project rules. This file is a compact handoff, not a changelog; verify git/build state before the next release task.

## Current milestone

- Multi-CD albums/box sets implemented: grouped shelf with a separate-disc toggle, shared metadata/cover defaults with explicit disc overrides, incomplete sets, disc subtitles, linking/detaching existing CDs, per-disc and whole-album deletion with Undo, selected/all-disc lookup import, album playback/queue/playlist shortcuts and whole-album or individual-disc Favorites selection.
- Each physical CD remains an independent record. `cd.set` stores stable release membership and materialized shared defaults; `meta.albums` still means Favorites. Existing optional CD/set fields, audio and untouched covers survive edits. Desktop release edits/imports/linking save as one document transaction and retain the draft after a failed save. No database migration or version change (0.2.0).
- Isolated checks completed: collection integration 25, role-picker stress 10 (Chrome/Edge), performer roles 10, unsaved form 8, lookup normalization 13, form sections 9, audio drafts 7, work inheritance 10, rendering 4, work tooltips 6. Work forms 8 also passed: all 110 checks across 11 suites are green. Windows build is pending. Updated older test expectations for current folded sections, short placeholders, performer ordering, Other hub and the restored set UI.
- User authorized committing/pushing main and running `build-windows.yml`. New Windows build and installer staging verification are pending; do not treat the old installers in `installers/nsis/` and `installers/msi/` as the multi-CD build yet.
- Rollback retained locally in `installers/rollback-before-multicd-20261031/`: previous NSIS/MSI installers, source archive, project guidance/handoff, and pre-change collection/previous-save snapshots. Source baseline is `409600c335449ea113a3be44648a203f5f69669b`, branch `codex/rollback-before-multicd-20261031`. Collection snapshots are private/ignored and must never be committed.
- Documentation consolidation is included with this milestone: stable short `AGENTS.md`, replacement `STATUS.md`, removal of duplicate `CLAUDE.md`.

## Awaiting confirmation / known limits

- User should retry multiple performer-role selection in the installed app. The picker was rebuilt and browser stress tests passed, but the original WebView2 `STATUS_BREAKPOINT` crash was not reproduced; installed-app resolution is not yet confirmed.
- Existing saved CDs are not silently rewritten by lookup fixes. Rerun the Liszt lookup (431 780-2) and save to apply corrected work-only durations.

## Unfinished account setup

These hosted changes remain unverified/unapplied after intermittent Supabase dashboard connectivity failures. Do not report them as complete or resume them without a relevant user request.

1. Apply `supabase/migrations/20261028_profile_handle_cooldown.sql` to project `ogpzmnaqybxybybooebi`: server-enforced 30 days (720 hours), timestamp/trigger and restrictive profile-delete policy. Verify the deployment using `supabase/README.md`.
2. Set hosted `mailer_otp_length` to 6 and verify both existing/new-user emails. The app shows a six-digit example but accepts 6–10 for compatibility; the project previously sent eight. Preserve SMTP and `{{ .Token }}` in both email templates.

## Next step

Finish the authorized Windows build, verify both installers in staging, then replace the current installer copies and record the run/source SHA here. Do not install or launch against the owner's collection for testing. Postponed work includes CD ripping, AI photo reading, phone sign-in, domain email, code signing, auto-update and additional platforms; none is authorized by this handoff.
