# Setting up accounts (Supabase)

CDC's accounts and online sync run on a free Supabase project. Do this once.

## 1. Create the project

1. Sign up at <https://supabase.com> and select **New project**.
2. Give it a name (for example `cdc`), choose a database password (keep it somewhere safe; the app does not need it) and pick the region closest to most of your users.
3. Wait a minute or two while the project starts.

## 2. Create the tables

1. Open **SQL Editor**, then **New query**.
2. Paste everything from [`schema.sql`](schema.sql) and select **Run**. It should finish with "Success. No rows returned".

For an existing project, run the entire [`20261028_profile_handle_cooldown.sql`](migrations/20261028_profile_handle_cooldown.sql) migration instead. It is transactional and safe to rerun. It preserves IDs, nicknames, photos and existing rows. Existing IDs get no invented change date: their first change after migration is allowed, then starts the cooldown. New IDs start the cooldown on initial assignment. Nicknames and photos can be changed at any time.

The trigger sets `handle_changed_at` from the database clock and rejects changes within 720 hours with `CDC_HANDLE_COOLDOWN` and an ISO UTC next-change time in the error detail. Client-supplied timestamps are ignored. Clearing an ID also counts as a change. An additive restrictive delete policy prevents deleting/recreating the row to bypass the cooldown, even alongside the existing own-profile `FOR ALL` policy. The migration drops or renames nothing. The existing case-insensitive unique index still prevents duplicate IDs. Account deletion through Auth can still cascade to the profile.

**Deployment status:** adding these files does not apply the migration to hosted Supabase. Until it is run and verified in the owner's project, server enforcement is pending. CDC detects the old schema, preserves existing profile loading and nickname/photo saving, and explains that ID changes require a server update.

## 3. Send sign-in codes instead of links

CDC's preferred email code is **six digits** (shown in the input example). During the hosted transition, it continues to accept **6–10 digits**, including the project's existing eight-digit codes, so sign-in remains usable before the server setting changes. Its UI alone cannot change how many digits the hosted server sends. In the project dashboard, open **Authentication** → **Sign In / Providers** → **Email** (the exact menu label may vary), set **Email OTP Length** to **6**, and save. Preserve the existing SMTP configuration and code expiry. If that setting is not exposed in the dashboard, an authorized project owner can use the [Management API auth configuration endpoint](https://supabase.com/docs/reference/api/v1-update-auth-service-config): `PATCH /v1/projects/ogpzmnaqybxybybooebi/config/auth` with only `{"mailer_otp_length":6}`, then read the configuration back to confirm. Management API credentials belong only in the owner's secure session, never in CDC, screenshots, logs or source control. Changing a local CLI configuration file does not change the hosted project.

Use your own email service under **Authentication** → **Emails** → **SMTP Settings** for delivery to other users (see the note at the end of this section). Then:

1. Open **Authentication** → **Emails** (called **Email Templates** in some versions).
2. Choose the **Magic link or OTP** template.
3. Make sure the message contains `{{ .Token }}`, which is where the code goes. For example:

   ```
   <h2>Your CDC sign-in code</h2>
   <p>Enter this code in CDC: <strong>{{ .Token }}</strong></p>
   <p>If you did not try to sign in, you can ignore this email.</p>
   ```

4. Save.
5. Do the same for the **Confirm sign up** template. Supabase sends that one instead the first time someone signs in, so it needs the code too. Otherwise new users get a link that can't open CDC.
6. Request a fresh code for an existing user and a first-time user, check that each email contains exactly six digits, and verify sign-in in CDC. Previously issued eight-digit codes remain accepted by CDC while the server considers them valid. Keep codes and session tokens out of test reports.

See Supabase's [passwordless email guide](https://supabase.com/docs/guides/auth/auth-email-passwordless) for the `{{ .Token }}` template and email verification flow.

**About the built-in email sender:** Supabase's own sender only delivers to the email addresses of your project's team members, and only a few emails an hour. That's enough for you to test. Before other people can sign up, add your own email service under **Authentication** → **Emails** → **SMTP Settings**. Resend, Brevo, or a QQ Mail or 163 mailbox with SMTP turned on all work.

## 4. Give the app the project's address and public key

1. Open **Project Settings** → **API Keys**.
2. Copy the **Project URL** (it looks like `https://abcdefgh.supabase.co`) and the **default publishable** key (`sb_publishable_…`; older projects call it the anon key).
3. Put them into `SUPABASE_URL` and `SUPABASE_KEY` near the top of the script in `src/index.html`.

The anon key is meant to be public and is safe inside the installer: row-level security means it can only reach each signed-in person's own rows. **Never** put the `service_role` / secret key in the app.

## 5. Owner / parent-agent live operations and checks

For project `ogpzmnaqybxybybooebi`, these operations require an existing authorized Supabase account session. No hosted changes are confirmed by this code patch:

1. Run the complete cooldown migration from section 2 in SQL Editor. Confirm `profiles.handle_changed_at` exists, `profiles_handle_cooldown` is enabled, and the new `profiles_no_client_delete` restrictive delete policy exists alongside the current own-profile policies. Reapplying the migration must preserve rows and timestamps.
2. With a disposable test account, assign an ID, then try changing it immediately: expect `CDC_HANDLE_COOLDOWN` and a next-change timestamp. Nickname/photo edits and saving the same ID must still work without moving that timestamp. A supplied timestamp must not override it. Deleting the profile via the authenticated API must fail or affect no rows. Verify a second account cannot take the same ID with different capitalization or access the first account's row. For the exact 30-day boundary, use a disposable SQL transaction/test fixture and roll it back; do not alter real profiles' timestamps.
3. Set hosted `mailer_otp_length` to `6`, read it back, retain `{{ .Token }}` in both templates, and test fresh existing-user and first-user emails as above. The app accepts the old eight-digit codes until the live change is confirmed; the six-digit placeholder does not prove the hosted setting changed.
4. Report migration execution/verification and OTP configuration/verification separately. Do not state that either is live until it has been checked. Never copy authentication tokens, emailed codes, SMTP passwords or management credentials into the report.
