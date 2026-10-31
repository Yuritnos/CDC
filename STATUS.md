# CDC current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. This file is a compact handoff, not a changelog; verify git/build state before the next release task.

## Current milestone

- Recording year, CD release year and Production technique accept free text, including long strings, date ranges, unknown dates and mixed SPARS values such as ADD/DDD. Removed year validation/length/numeric-keyboard restrictions; technique is a text input with optional DDD/ADD/AAD suggestions. Lookup no longer rejects pre-1980 release years or nonstandard SPARS values. Set name and its form opt out of browser autocomplete; the actual set title remains persisted for identification.
- Fixed Discogs performer scope: explicit work/index/track or release-scoped credits take precedence over inference from the release's headline artist list. A named artist with explicit credits is not silently inferred onto other works/discs. Uncredited headline artist role inference remains available. Chorus Master is retained as a person/custom role instead of being mistaken for a choir/ensemble.
- Investigated public [Discogs release 4600502](https://api.discogs.com/releases/4600502), barcode 028944443028. It already provides precise orchestra credits on all 17 work indexes; CDC's release-artist fallback caused the leakage. Audited all 11 discs/all 17 works, including singer/choir roles: discs 1/2/3/6 use LPO defaults; 5/7/8/9/10 use Concertgebouworkest defaults; discs 4 and 11 have no common orchestra and keep each orchestra at work level. Disc 4: Symphony 5 Concertgebouworkest, Symphony 9 LPO; disc 11: Symphony 15 LPO, Jewish Folk Poetry Concertgebouworkest. Public factual regression fixture: `tests/fixtures/discogs-4600502.json`; no owner collection/account used. Source may still have missing/inaccurate credits; unscoped source credits stay unscoped.
- Existing grouped shelves/counts/statistics, shared set-cover editing, independent disc metadata/audio, work inheritance, staged deletion/Undo and profile details icons remain intact. Work lists stay in unfolded discs rather than repeated in the details popup. Existing saved CDs are not silently migrated: rerun lookup and confirm Save to apply corrected credits.
- All 122 isolated checks across 11 suites passed: collection integration 35, role-picker stress 10 (Chrome/Edge), performer roles 10, unsaved form 8, lookup normalization 15, form sections 9, audio drafts 7, work inheritance 10, rendering 4, work tooltips 6, work forms 8. Includes full 11-disc import/save/reload/edit, all 17 works' performer roles, explicit credit scopes and free-text details roundtrip. QA audit/screenshot under `installers/qa-lookup-scopes/`. Source HTML SHA-256: `b4c69e9cfa56ef51d8bf53ff16c63409be31d1ac87cbeb0826ebbd73e1fb959e`.
- Windows build 30 succeeded (version 0.2.0), app source `1d5d56e3ab2354bd3e238a5f03c2815f6f797f2d`, [Actions run 41230809699](https://github.com/Yuritnos/CDC/actions/runs/41230809699). Downloaded CDC-windows archive matches GitHub's SHA-256; both installers passed staging integrity, extraction, x64 PE/product/version and payload-equivalence checks before replacing `installers/nsis/` and `installers/msi/`. Evidence: `installers/staging-credit-scopes-41230809699/verification.json`. NSIS: 2,008,712 bytes, SHA-256 `A2530026AB32E008CBCF839896145694F52AF33AF70C18744A9ACDF586421006`; MSI: 2,699,264 bytes, SHA-256 `CE213423964743B40674039227E7DD5B3C4A7274610E12758D44B23B00266340`. No version change, database migration, application installation, tags or releases performed.
- Build-29 rollback is checksum-verified in `installers/rollback-before-credit-scopes-20261101/`: installers, source archive, hashes, ROLLBACK.md and private collection/previous-save snapshots; pushed branch `codex/rollback-before-credit-scopes-20261101` retains the previous main head. Owner collection file remained unchanged. Earlier rollback folders/branches remain for builds 28/27/26 and pre-multi-CD. Collection snapshots are ignored/private and must never be committed.

## Awaiting confirmation / known limits

- User should retry multiple performer-role selection in the installed app. The picker was rebuilt and browser stress tests passed, but the original WebView2 `STATUS_BREAKPOINT` crash was not reproduced; installed-app resolution is not yet confirmed.
- Existing saved CDs are not silently rewritten by lookup fixes. Rerun the Liszt lookup (431 780-2) and save to apply corrected work-only durations.
- New multi-CD behavior has isolated browser coverage and successful native compilation/package checks; installed-app feedback is still needed. Installer verification did not launch CDC against the owner's collection.

## Unfinished account setup

These hosted changes remain unverified/unapplied after intermittent Supabase dashboard connectivity failures. Do not report them as complete or resume them without a relevant user request.

1. Apply `supabase/migrations/20261028_profile_handle_cooldown.sql` to project `ogpzmnaqybxybybooebi`: server-enforced 30 days (720 hours), timestamp/trigger and restrictive profile-delete policy. Verify the deployment using `supabase/README.md`.
2. Set hosted `mailer_otp_length` to 6 and verify both existing/new-user emails. The app shows a six-digit example but accepts 6–10 for compatibility; the project previously sent eight. Preserve SMTP and `{{ .Token }}` in both email templates.

## Next step

Requested fixes, Windows build, download and verified installer replacement are complete. Await installed-app feedback; rerun lookup and save existing sets to apply the corrected performer credits. Do not install or launch against the owner's collection for testing. Postponed work includes CD ripping, AI photo reading, phone sign-in, domain email, code signing, auto-update and additional platforms; none is authorized by this handoff.
