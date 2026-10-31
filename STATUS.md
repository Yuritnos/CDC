# CDC current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. This file is a compact handoff, not a changelog; verify git/build state before the next release task.

## Current milestone

- Albums always group on the shelf in both views; the Group album CDs button is removed and obsolete groupDiscs=false preferences are ignored without rewriting saved settings. Shelf counts show albums / saved discs (including filtered results and standalone albums). Statistics adds Albums before CDs; missing/unregistered discs do not inflate either count.
- The editor has one accessible Standalone or set selector with exactly Standalone CD and Album / box set. Removed the duplicate Album membership label. Add a disc now matches the adjacent link style; both existing/new disc removal controls say Delete this disc. Independent disc metadata/works/audio, staged removal, atomic saves, Undo and delayed cleanup remain intact.
- Set cover uploads, cropping, replacement, removal and lookup artwork now belong to the whole album in set.cover and remain stable across disc tabs. New set members do not receive individual artwork. Legacy disc artwork stays untouched for compatibility, is hidden from disc previews, and cannot be edited separately inside a set. Updated covers propagate atomically to saved members; explicit empty set covers prevent removed artwork returning. Export/sync keep the existing set-cover format.
- Disc details icons retain hover/focus, click pinning, Escape and bounded keyboard-accessible dialogs; removed the repeated works section (works remain in each unfolded disc). Album footer remains Edit / Add to favorites / Delete; playback/link/playlist controls remain through All music.
- All 119 isolated checks across 11 suites passed: collection integration 34, role-picker stress 10 (Chrome/Edge), performer roles 10, unsaved form 8, lookup normalization 13, form sections 9, audio drafts 7, work inheritance 10, rendering 4, work tooltips 6, work forms 8. Added coverage for grouping despite old preferences, album/disc counts, shared cover cropping/removal/failed saves and late lookup artwork after tab switching/manual removal. Layouts checked in en/ja/zh, both themes and narrow widths; QA images under `installers/qa-album-cover/`. Source HTML SHA-256: `24701d50eb394d21e76f0ff9475b86caa5b7cb085c0cb45067957ed7756e2f6a`.
- Windows build 29 succeeded (version 0.2.0), app source `3ea09e11dee31fbc71d15a18deaa64d15ec16225`, [Actions run 41227607717](https://github.com/Yuritnos/CDC/actions/runs/41227607717). Downloaded CDC-windows archive matches GitHub's SHA-256; both installers passed staging integrity, extraction, x64 PE/product/version and payload-equivalence checks before replacing `installers/nsis/` and `installers/msi/`. Evidence: `installers/staging-album-cover-41227607717/verification.json`. NSIS: 2,008,607 bytes, SHA-256 `3D327622708AA033FFE063C69DD50087A360917F48753FAD6967A293FC858761`; MSI: 2,699,264 bytes, SHA-256 `80A5C624DB0C03935AA09BEDB4BB064EB45EC912B058B49E2506DBFF8B3B8D0D`. No version change, database migration, application installation, tags or releases performed.
- Build-28 rollback is checksum-verified in `installers/rollback-before-album-cover-20261101/`: installers, source archive, hashes, ROLLBACK.md and private collection/previous-save snapshots; pushed branch `codex/rollback-before-album-cover-20261101` retains the previous main head. Owner collection file remained unchanged. Earlier rollback folders/branches remain for builds 27, 26 and pre-multi-CD. Collection snapshots are ignored/private and must never be committed.

## Awaiting confirmation / known limits

- User should retry multiple performer-role selection in the installed app. The picker was rebuilt and browser stress tests passed, but the original WebView2 `STATUS_BREAKPOINT` crash was not reproduced; installed-app resolution is not yet confirmed.
- Existing saved CDs are not silently rewritten by lookup fixes. Rerun the Liszt lookup (431 780-2) and save to apply corrected work-only durations.
- New multi-CD behavior has isolated browser coverage and successful native compilation/package checks; installed-app feedback is still needed. Installer verification did not launch CDC against the owner's collection.

## Unfinished account setup

These hosted changes remain unverified/unapplied after intermittent Supabase dashboard connectivity failures. Do not report them as complete or resume them without a relevant user request.

1. Apply `supabase/migrations/20261028_profile_handle_cooldown.sql` to project `ogpzmnaqybxybybooebi`: server-enforced 30 days (720 hours), timestamp/trigger and restrictive profile-delete policy. Verify the deployment using `supabase/README.md`.
2. Set hosted `mailer_otp_length` to 6 and verify both existing/new-user emails. The app shows a six-digit example but accepts 6–10 for compatibility; the project previously sent eight. Preserve SMTP and `{{ .Token }}` in both email templates.

## Next step

Requested optimizations, Windows build, download and verified installer replacement are complete. Await installed-app feedback on always-grouped albums and shared set-cover editing; do not install or launch against the owner's collection for testing. Postponed work includes CD ripping, AI photo reading, phone sign-in, domain email, code signing, auto-update and additional platforms; none is authorized by this handoff.
