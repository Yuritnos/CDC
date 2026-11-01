# Setting up accounts (Supabase)

PMCO's accounts and online sync run on a free Supabase project. Do this once.

## 1. Create the project

1. Sign up at <https://supabase.com> and select **New project**.
2. Give it a name (for example `cdc`), choose a database password (keep it somewhere safe; the app does not need it) and pick the region closest to most of your users.
3. Wait a minute or two while the project starts.

## 2. Create the tables

1. Open **SQL Editor**, then **New query**.
2. Paste everything from [`schema.sql`](schema.sql) and select **Run**. It should finish with "Success. No rows returned".

For an existing project without the timestamp column/trigger, first run [`20261101_profile_handle_rules.sql`](migrations/20261101_profile_handle_rules.sql), then [`20261101_profile_handle_relaxed.sql`](migrations/20261101_profile_handle_relaxed.sql). If the first migration is already deployed, apply only the relaxed migration. Both preserve existing IDs, nicknames, photos and rows.

New and changed IDs use **4–20 ASCII letters, numbers or underscores**. Existing shorter IDs survive unchanged during nickname/photo edits. The monthly change limit is **temporarily suspended** in the client and database. The server still records change timestamps, enforces case-insensitive uniqueness and preserves RLS/own-profile access. The restrictive profile-delete policy is unchanged.

Existing projects should run migrations in order, ending with `migrations/20261101_profile_handle_relaxed.sql`. This replaces only the trigger function; it does not rewrite profiles, remove timestamps or change access policies. The full schema includes the same current rule. Historical cooldown migrations remain for upgrade history; do not reapply an older migration after the relaxed one.

Deployment verification is recorded in STATUS.md. The client hides the monthly notice while suspended; any legacy server cooldown error uses a generic monthly message, never an exact date or nickname sentence. Email OTP is configured separately.

## 3. Send sign-in codes instead of links

PMCO's preferred email code is **six digits** (shown in the input example). During the hosted transition, it continues to accept **6–10 digits**, including the project's existing eight-digit codes, so sign-in remains usable before the server setting changes. Its UI alone cannot change how many digits the hosted server sends. In the project dashboard, open **Authentication** → **Sign In / Providers** → **Email** (the exact menu label may vary), set **Email OTP Length** to **6**, and save. Preserve the existing SMTP configuration and code expiry. If that setting is not exposed in the dashboard, an authorized project owner can use the [Management API auth configuration endpoint](https://supabase.com/docs/reference/api/v1-update-auth-service-config): `PATCH /v1/projects/ogpzmnaqybxybybooebi/config/auth` with only `{"mailer_otp_length":6}`, then read the configuration back to confirm. Management API credentials belong only in the owner's secure session, never in PMCO, screenshots, logs or source control. Changing a local CLI configuration file does not change the hosted project.

Use your own email service under **Authentication** → **Emails** → **SMTP Settings** for delivery to other users (see the note at the end of this section). Then:

1. Open **Authentication** → **Emails** (called **Email Templates** in some versions).
2. Choose the **Magic link or OTP** template.
3. Make sure the message contains `{{ .Token }}`, which is where the code goes. For example:

   ```
   <h2>Your PMCO sign-in code</h2>
   <p>Enter this code in PMCO: <strong>{{ .Token }}</strong></p>
   <p>If you did not try to sign in, you can ignore this email.</p>
   ```

4. Save.
5. Do the same for the **Confirm sign up** template. Supabase sends that one instead the first time someone signs in, so it needs the code too. Otherwise new users get a link that can't open PMCO.
6. Request a fresh code for an existing user and a first-time user, check that each email contains exactly six digits, and verify sign-in in PMCO. Previously issued eight-digit codes remain accepted by PMCO while the server considers them valid. Keep codes and session tokens out of test reports.

See Supabase's [passwordless email guide](https://supabase.com/docs/guides/auth/auth-email-passwordless) for the `{{ .Token }}` template and email verification flow.

**About the built-in email sender:** Supabase's own sender only delivers to the email addresses of your project's team members, and only a few emails an hour. That's enough for you to test. Before other people can sign up, add your own email service under **Authentication** → **Emails** → **SMTP Settings**. Resend, Brevo, or a QQ Mail or 163 mailbox with SMTP turned on all work.

## 4. Give the app the project's address and public key

1. Open **Project Settings** → **API Keys**.
2. Copy the **Project URL** (it looks like `https://abcdefgh.supabase.co`) and the **default publishable** key (`sb_publishable_…`; older projects call it the anon key).
3. Put them into `SUPABASE_URL` and `SUPABASE_KEY` near the top of the script in `src/index.html`.

The anon key is meant to be public and is safe inside the installer: row-level security means it can only reach each signed-in person's own rows. **Never** put the `service_role` / secret key in the app.

## 5. Owner / parent-agent live operations and checks

For project `ogpzmnaqybxybybooebi`, these operations require an authorized Supabase account session. The profile migration is confirmed above; use these checks for future deployments:

1. Apply the latest relaxed-ID migration. Verify the enabled profile trigger's function checks 4–20 characters and contains no cooldown rejection. Keep the unique index, timestamp column and own-profile/restrictive-delete policies.
2. Use isolated PostgreSQL fixtures to verify repeated immediate changes, clearing/reassignment, invalid IDs, case-insensitive uniqueness, legacy-ID preservation, timestamp forgery protection and cross-account RLS. Never edit the owner's profile for testing.
3. Verify hosted email OTP settings separately. Keep authentication tokens, email codes, SMTP passwords and management credentials out of reports.
