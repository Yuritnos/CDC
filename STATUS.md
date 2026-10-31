# CDC current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. This file is a compact handoff, not a changelog; verify git/build state before the next release task.

## Current milestone

- Simplified membership/editor implemented: the menu always contains exactly Standalone CD and Album / box set; saved album names are never appended. Standalone hides all disc tabs/Add a disc controls and saves only the selected disc without set membership. Switching an existing member to standalone detaches that disc while preserving the other saved members. Existing set IDs, hidden subtitles/extensions and untouched audio/covers are retained.
- Removed the shared-information checkbox, inheritance pickers and metadata propagation. Each disc's information, works, physical details and audio are edited independently. New manual discs start with empty metadata fields. Album summaries derive only common metadata from the actual saved disc values; legacy shared metadata/main-cover fields remain compatible with import/export/sync and rollback.
- Album profiles now have only Edit, Add to favorites and Delete in the footer. Removed Add another disc and the per-disc action rows. Each disc heading has a right-aligned details icon: paused hover/focus opens a bounded, scrollable read-only dialog with disc facts, works and audio metadata; click pins it, Escape closes it without unfolding the disc. Link/play/enqueue/playlist controls still appear only through All music.
- Disc add/edit/detach/delete operations are available in the album editor. Existing-disc deletion is staged until Save; desktop update/delete commits atomically and restores deletion markers on failure. After saving, Undo restores removed discs and Favorite/playlist membership; original audio cleanup waits until Undo expires. New draft discard/import validation and keyboard/reduced-motion behavior remain intact.
- All 117 isolated checks across 11 suites passed: collection integration 32, role-picker stress 10 (Chrome/Edge), performer roles 10, unsaved form 8, lookup normalization 13, form sections 9, audio drafts 7, work inheritance 10, rendering 4, work tooltips 6, work forms 8. Dialog/editor layouts checked in en/ja/zh, both themes and narrow widths. Source HTML SHA-256: `5f4a7710893e5bb6693ea92f7fa9d7a8373064808da7bda4b6ed08c06b9efcdb`.
- Windows build 28 succeeded (version 0.2.0), app source `9ada3fb4f17676b97d8ce7eb9281087ea52b6818`, [Actions run 41224253537](https://github.com/Yuritnos/CDC/actions/runs/41224253537). Downloaded `CDC-windows` archive matches GitHub's SHA-256; both installers passed staging integrity, extraction, x64 PE/product/version and payload-equivalence checks before replacing `installers/nsis/` and `installers/msi/`. Evidence: `installers/staging-profile-simplification-41224253537/verification.json`. NSIS: 2,008,395 bytes, SHA-256 `7A6DEBC6C66FB50E4143DDEE1D90BECF15D8A9E29A3FB374F733C426CE48AD11`; MSI: 2,699,264 bytes, SHA-256 `0F7604F31EF35498977C6DF353E2CE454AECE7C06F9397E78B0B82DAA088C257`. No version change, database migration, application installation, tags or releases performed.
- Build-27 rollback saved and checksum-verified in `installers/rollback-before-profile-simplification-20261101/`: both installers, source archive, hashes, `ROLLBACK.md` and private collection/previous-save snapshots; pushed branch `codex/rollback-before-profile-simplification-20261101` retains the previous main head. Owner collection file remained unchanged. Earlier rollback folders/branches remain for build 26 (`rollback-before-disc-editor-20261101`) and pre-multi-CD (`rollback-before-multicd-20261031`). Collection snapshots are ignored/private and must never be committed.

## Awaiting confirmation / known limits

- User should retry multiple performer-role selection in the installed app. The picker was rebuilt and browser stress tests passed, but the original WebView2 `STATUS_BREAKPOINT` crash was not reproduced; installed-app resolution is not yet confirmed.
- Existing saved CDs are not silently rewritten by lookup fixes. Rerun the Liszt lookup (431 780-2) and save to apply corrected work-only durations.
- New multi-CD behavior has isolated browser coverage and successful native compilation/package checks; installed-app feedback is still needed. Installer verification did not launch CDC against the owner's collection.

## Unfinished account setup

These hosted changes remain unverified/unapplied after intermittent Supabase dashboard connectivity failures. Do not report them as complete or resume them without a relevant user request.

1. Apply `supabase/migrations/20261028_profile_handle_cooldown.sql` to project `ogpzmnaqybxybybooebi`: server-enforced 30 days (720 hours), timestamp/trigger and restrictive profile-delete policy. Verify the deployment using `supabase/README.md`.
2. Set hosted `mailer_otp_length` to 6 and verify both existing/new-user emails. The app shows a six-digit example but accepts 6–10 for compatibility; the project previously sent eight. Preserve SMTP and `{{ .Token }}` in both email templates.

## Next step

Requested implementation/build/download/replacement are complete. Await installed-app feedback on the simplified membership/editor and disc-details popup; do not install or launch against the owner's collection for testing. Postponed work includes CD ripping, AI photo reading, phone sign-in, domain email, code signing, auto-update and additional platforms; none is authorized by this handoff.
