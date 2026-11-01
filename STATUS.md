# CDC current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. This file is a compact handoff, not a changelog; verify git/build state before the next release task.

## Current milestone

- Completed the four requested UI changes: profile work-info icons follow the work title; their popups avoid the whole heading. Set profiles use the same separate, linked role/name facts as standalone CDs, displaying each person once with combined roles. Shared work type appears under composer in the same style as standalone profiles.
- Performer rows support Alt+drag and Alt+Up/Down in both disc and work editors. A person moves together with all standard/custom roles, within the same list only. Ordering remains a draft until Save and survives reopen; Discard restores it. Normal text dragging, cancellation/Escape, empty boundaries, busy audio/editor state and clicks on Save after dragging remain safe. No new persistence format or native changes.
- Works on this disc starts open when loading saved or lookup works, and folded for an empty disc. Manual fold states are retained across disc tabs; folding alone remains clean. Nested Work details and Audio still start folded. AGENTS.md has been updated with these rules and the previous set-cover/free-text/lookup invariants for the next chat.
- Previous behavior retained: always-grouped albums and album/disc statistics; one set cover with independent disc metadata/audio; free-text years/production technique; no browser Set-name autocomplete. Discogs explicit credit scopes beat headline-artist inference. Public 028944443028 fixture still covers all 11 discs/17 works (including mixed-orchestra discs 4/11); source omissions remain possible. Existing saved CDs need lookup rerun and Save to receive corrections; they are never silently rewritten.
- All 125 isolated checks across 11 suites passed: collection integration 38, role-picker stress 10 (Chrome/Edge), performer roles 10, unsaved form 8, lookup normalization 15, form sections 9, audio drafts 7, work inheritance 10, rendering 4, work tooltips 6, work forms 8. New checks cover pointer/keyboard ordering, roles, scope boundaries, Save/reopen/Discard, populated/empty/manual folds and localized profile/tooltip placement. Visual QA: `installers/qa-performer-order/`. Source HTML SHA-256: `f9599198789b3ebc2113ef027c76e82f8d083df652dab3a630f371d9ec7d3908`.
- Windows build 30 succeeded (version 0.2.0), app source `1d5d56e3ab2354bd3e238a5f03c2815f6f797f2d`, [Actions run 41230809699](https://github.com/Yuritnos/CDC/actions/runs/41230809699). Downloaded CDC-windows archive matches GitHub's SHA-256; both installers passed staging integrity, extraction, x64 PE/product/version and payload-equivalence checks before replacing `installers/nsis/` and `installers/msi/`. Evidence: `installers/staging-credit-scopes-41230809699/verification.json`. NSIS: 2,008,712 bytes, SHA-256 `A2530026AB32E008CBCF839896145694F52AF33AF70C18744A9ACDF586421006`; MSI: 2,699,264 bytes, SHA-256 `CE213423964743B40674039227E7DD5B3C4A7274610E12758D44B23B00266340`. No version change, database migration, application installation, tags or releases performed.
- User authorized the Windows build for these UI changes. Source push/build/download/staging replacement are pending; current installer copies remain verified build 30 above. Build-30 rollback is checksum-verified in `installers/rollback-before-performer-order-20261101/`: installers, source archive, hashes, ROLLBACK.md and private collection/previous-save snapshots; branch `codex/rollback-before-performer-order-20261101` retains the previous main head. Earlier rollback folders/branches remain for builds 29/28/27/26 and pre-multi-CD. Collection snapshots are ignored/private and must never be committed.

## Awaiting confirmation / known limits

- User should retry multiple performer-role selection in the installed app. The picker was rebuilt and browser stress tests passed, but the original WebView2 `STATUS_BREAKPOINT` crash was not reproduced; installed-app resolution is not yet confirmed.
- Existing saved CDs are not silently rewritten by lookup fixes. Rerun the Liszt lookup (431 780-2) and save to apply corrected work-only durations.
- New multi-CD behavior has isolated browser coverage and successful native compilation/package checks; installed-app feedback is still needed. Installer verification did not launch CDC against the owner's collection.

## Unfinished account setup

These hosted changes remain unverified/unapplied after intermittent Supabase dashboard connectivity failures. Do not report them as complete or resume them without a relevant user request.

1. Apply `supabase/migrations/20261028_profile_handle_cooldown.sql` to project `ogpzmnaqybxybybooebi`: server-enforced 30 days (720 hours), timestamp/trigger and restrictive profile-delete policy. Verify the deployment using `supabase/README.md`.
2. Set hosted `mailer_otp_length` to 6 and verify both existing/new-user emails. The app shows a six-digit example but accepts 6–10 for compatibility; the project previously sent eight. Preserve SMTP and `{{ .Token }}` in both email templates.

## Next step

Finish the authorized Windows build, download CDC-windows, verify both installers in staging, replace the current copies and finalize this handoff for the user's new chat. Do not install or launch against the owner's collection for testing. Postponed work includes CD ripping, AI photo reading, phone sign-in, domain email, code signing, auto-update and additional platforms; none is authorized by this handoff.
