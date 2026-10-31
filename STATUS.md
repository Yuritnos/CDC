# CDC current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. This file is a compact handoff, not a changelog; verify git/build state before the next release task.

## Current milestone

- Albums always group on the shelf in both views; the Group album CDs button is removed and obsolete groupDiscs=false preferences are ignored without rewriting saved settings. Shelf counts show albums / saved discs (including filtered results and standalone albums). Statistics adds Albums before CDs; missing/unregistered discs do not inflate either count.
- The editor has one accessible Standalone or set selector with exactly Standalone CD and Album / box set. Removed the duplicate Album membership label. Add a disc now matches the adjacent link style; both existing/new disc removal controls say Delete this disc. Independent disc metadata/works/audio, staged removal, atomic saves, Undo and delayed cleanup remain intact.
- Set cover uploads, cropping, replacement, removal and lookup artwork now belong to the whole album in set.cover and remain stable across disc tabs. New set members do not receive individual artwork. Legacy disc artwork stays untouched for compatibility, is hidden from disc previews, and cannot be edited separately inside a set. Updated covers propagate atomically to saved members; explicit empty set covers prevent removed artwork returning. Export/sync keep the existing set-cover format.
- Disc details icons retain hover/focus, click pinning, Escape and bounded keyboard-accessible dialogs; removed the repeated works section (works remain in each unfolded disc). Album footer remains Edit / Add to favorites / Delete; playback/link/playlist controls remain through All music.
- All 119 isolated checks across 11 suites passed: collection integration 34, role-picker stress 10 (Chrome/Edge), performer roles 10, unsaved form 8, lookup normalization 13, form sections 9, audio drafts 7, work inheritance 10, rendering 4, work tooltips 6, work forms 8. Added coverage for grouping despite old preferences, album/disc counts, shared cover cropping/removal/failed saves and late lookup artwork after tab switching/manual removal. Layouts checked in en/ja/zh, both themes and narrow widths; QA images under `installers/qa-album-cover/`. Source HTML SHA-256: `24701d50eb394d21e76f0ff9475b86caa5b7cb085c0cb45067957ed7756e2f6a`.
- Windows build 28 succeeded (version 0.2.0), app source `9ada3fb4f17676b97d8ce7eb9281087ea52b6818`, [Actions run 41224253537](https://github.com/Yuritnos/CDC/actions/runs/41224253537). Downloaded `CDC-windows` archive matches GitHub's SHA-256; both installers passed staging integrity, extraction, x64 PE/product/version and payload-equivalence checks before replacing `installers/nsis/` and `installers/msi/`. Evidence: `installers/staging-profile-simplification-41224253537/verification.json`. NSIS: 2,008,395 bytes, SHA-256 `7A6DEBC6C66FB50E4143DDEE1D90BECF15D8A9E29A3FB374F733C426CE48AD11`; MSI: 2,699,264 bytes, SHA-256 `0F7604F31EF35498977C6DF353E2CE454AECE7C06F9397E78B0B82DAA088C257`. No version change, database migration, application installation, tags or releases performed.
- User authorized a new Windows build after these optimizations. Source push/build/download/staging replacement are pending; current installer copies remain verified build 28 above. Build-28 rollback is checksum-verified in `installers/rollback-before-album-cover-20261101/`: installers, source archive, hashes, `ROLLBACK.md` and private collection/previous-save snapshots; branch `codex/rollback-before-album-cover-20261101` retains the previous main head. Earlier rollback folders/branches remain for builds 27, 26 and pre-multi-CD. Collection snapshots are ignored/private and must never be committed.

## Awaiting confirmation / known limits

- User should retry multiple performer-role selection in the installed app. The picker was rebuilt and browser stress tests passed, but the original WebView2 `STATUS_BREAKPOINT` crash was not reproduced; installed-app resolution is not yet confirmed.
- Existing saved CDs are not silently rewritten by lookup fixes. Rerun the Liszt lookup (431 780-2) and save to apply corrected work-only durations.
- New multi-CD behavior has isolated browser coverage and successful native compilation/package checks; installed-app feedback is still needed. Installer verification did not launch CDC against the owner's collection.

## Unfinished account setup

These hosted changes remain unverified/unapplied after intermittent Supabase dashboard connectivity failures. Do not report them as complete or resume them without a relevant user request.

1. Apply `supabase/migrations/20261028_profile_handle_cooldown.sql` to project `ogpzmnaqybxybybooebi`: server-enforced 30 days (720 hours), timestamp/trigger and restrictive profile-delete policy. Verify the deployment using `supabase/README.md`.
2. Set hosted `mailer_otp_length` to 6 and verify both existing/new-user emails. The app shows a six-digit example but accepts 6–10 for compatibility; the project previously sent eight. Preserve SMTP and `{{ .Token }}` in both email templates.

## Next step

Finish the authorized Windows build, download CDC-windows and verify both installers in staging before replacing the current copies; record the run and source here. Do not install or launch against the owner's collection for testing. Postponed work includes CD ripping, AI photo reading, phone sign-in, domain email, code signing, auto-update and additional platforms; none is authorized by this handoff.
