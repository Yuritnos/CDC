# CDC current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. This file is a compact handoff, not a changelog; verify git/build state before the next release task.

## Current milestone

- Corrected the work-info placement after user feedback: profile icons sit at the far right of the entire heading, after any work-only duration. Work and disc info popups share the same right-anchored, above/below-heading placement helper; work popups no longer anchor to the left of the panel. Bounds, scrolling, title avoidance and keyboard access remain intact. Set profiles retain linked role/name facts matching standalone CDs, with each person once and combined roles.
- Performer rows support Alt+drag and Alt+Up/Down in both disc and work editors. A person moves together with all standard/custom roles, within the same list only. Ordering remains a draft until Save and survives reopen; Discard restores it. Normal text dragging, cancellation/Escape, empty boundaries, busy audio/editor state and clicks on Save after dragging remain safe. No new persistence format or native changes.
- Works on this disc starts open when loading saved or lookup works, and folded for an empty disc. Manual fold states are retained across disc tabs; folding alone remains clean. Nested Work details and Audio still start folded. AGENTS.md has been updated with these rules and the previous set-cover/free-text/lookup invariants for the next chat.
- Previous behavior retained: always-grouped albums and album/disc statistics; one set cover with independent disc metadata/audio; free-text years/production technique; no browser Set-name autocomplete. Discogs explicit credit scopes beat headline-artist inference. Public 028944443028 fixture still covers all 11 discs/17 works (including mixed-orchestra discs 4/11); source omissions remain possible. Existing saved CDs need lookup rerun and Save to receive corrections; they are never silently rewritten.
- This placement correction passed all 48 relevant checks: collection integration 38, work tooltips 6 and rendering 4. Tests assert far-right icons (including duration-bearing works), right-anchored popups, no title overlap and bounded layouts across en/ja/zh, narrow widths and both themes. Visual QA: `installers/qa-work-info-placement/`. Source HTML SHA-256: `901051793589da112e27c09b31db632296eb667ba5460a4b9e9b94ba98ef7d61`. The preceding build 31 passed all 125 checks across 11 suites; unrelated suites were not repeated for this presentation correction.
- Windows build 31 succeeded (version 0.2.0), app source `74dec9d8b0fd525f4357019f64de375c06b2ca9d`, [Actions run 41266622842](https://github.com/Yuritnos/CDC/actions/runs/41266622842). Downloaded CDC-windows archive matches GitHub's SHA-256; both installers passed staging integrity, extraction, x64 PE/product/version and payload-equivalence checks before replacing `installers/nsis/` and `installers/msi/`. Evidence: `installers/staging-performer-order-41266622842/verification.json`. NSIS: 2,010,326 bytes, SHA-256 `458B17717CCA69E1840CD19442E7D7A9200CAB654F8E99AC292D1549A6977D4F`; MSI: 2,699,264 bytes, SHA-256 `4AF28B2C3D3E97A2E49847E958B1F555A767A1927DFD9C221763840355C4D5DB`. No version change, database migration, application installation, tags or releases performed.
- Rebuilding for the corrected placement is pending; current installer copies remain verified build 31 above. Build-31 rollback is checksum-verified in `installers/rollback-before-work-info-placement-20261101/`: installers, source archive, hashes and ROLLBACK.md; branch `codex/rollback-before-work-info-placement-20261101` retains the previous main head. Earlier rollback folders/branches remain for builds 30/29/28/27/26 and pre-multi-CD. Older private collection snapshots must never be committed or restored over later user changes; this presentation correction needs no data restoration.

## Awaiting confirmation / known limits

- User should retry multiple performer-role selection in the installed app. The picker was rebuilt and browser stress tests passed, but the original WebView2 `STATUS_BREAKPOINT` crash was not reproduced; installed-app resolution is not yet confirmed.
- Existing saved CDs are not silently rewritten by lookup fixes. Rerun the Liszt lookup (431 780-2) and save to apply corrected work-only durations.
- New multi-CD behavior has isolated browser coverage and successful native compilation/package checks; installed-app feedback is still needed. Installer verification did not launch CDC against the owner's collection.

## Unfinished account setup

These hosted changes remain unverified/unapplied after intermittent Supabase dashboard connectivity failures. Do not report them as complete or resume them without a relevant user request.

1. Apply `supabase/migrations/20261028_profile_handle_cooldown.sql` to project `ogpzmnaqybxybybooebi`: server-enforced 30 days (720 hours), timestamp/trigger and restrictive profile-delete policy. Verify the deployment using `supabase/README.md`.
2. Set hosted `mailer_otp_length` to 6 and verify both existing/new-user emails. The app shows a six-digit example but accepts 6–10 for compatibility; the project previously sent eight. Preserve SMTP and `{{ .Token }}` in both email templates.

## Next step

Finish the corrected Windows build, verify/download/replace both installers, and record its run/source here. Then this handoff is ready for the user's new chat; wait for new feature scope. Do not install or launch against the owner's collection for testing. Postponed work includes CD ripping, AI photo reading, phone sign-in, domain email, code signing, auto-update and additional platforms; none is authorized by this handoff.
