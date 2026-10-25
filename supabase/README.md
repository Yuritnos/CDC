# Setting up accounts (Supabase)

CDC's accounts and online sync run on a free Supabase project. Do this once.

## 1. Create the project

1. Sign up at <https://supabase.com> and select **New project**.
2. Give it a name (for example `cdc`), choose a database password (keep it somewhere safe; the app does not need it) and pick the region closest to most of your users.
3. Wait a minute or two while the project starts.

## 2. Create the tables

1. Open **SQL Editor**, then **New query**.
2. Paste everything from [`schema.sql`](schema.sql) and select **Run**. It should finish with "Success. No rows returned".

## 3. Send sign-in codes instead of links

CDC signs people in with a code from their email (Supabase currently sends 8 digits; CDC accepts 6 to 10). Supabase's built-in email only sends a link and can't be edited, so first connect your own email service under **Authentication** → **Emails** → **SMTP Settings** (see the note at the end of this section). Then:

1. Open **Authentication** → **Emails** (called **Email Templates** in some versions).
2. Choose the **Magic link or OTP** template.
3. Make sure the message contains `{{ .Token }}`, which is where the code goes. For example:

   ```
   <h2>Your CDC sign-in code</h2>
   <p>Enter this code in CDC: <strong>{{ .Token }}</strong></p>
   <p>It works for one hour. If you did not try to sign in, you can ignore this email.</p>
   ```

4. Save.
5. Do the same for the **Confirm sign up** template. Supabase sends that one instead the first time someone signs in, so it needs the code too. Otherwise new users get a link that can't open CDC.

**About the built-in email sender:** Supabase's own sender only delivers to the email addresses of your project's team members, and only a few emails an hour. That's enough for you to test. Before other people can sign up, add your own email service under **Authentication** → **Emails** → **SMTP Settings**. Resend, Brevo, or a QQ Mail or 163 mailbox with SMTP turned on all work.

## 4. Give the app the project's address and public key

1. Open **Project Settings** → **API Keys**.
2. Copy the **Project URL** (it looks like `https://abcdefgh.supabase.co`) and the **default publishable** key (`sb_publishable_…`; older projects call it the anon key).
3. Put them into `SUPABASE_URL` and `SUPABASE_KEY` near the top of the script in `src/index.html`.

The anon key is meant to be public and is safe inside the installer: row-level security means it can only reach each signed-in person's own rows. **Never** put the `service_role` / secret key in the app.
