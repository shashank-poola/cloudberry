# Cloudberry authentication

Cloudberry uses Supabase Auth with Google and GitHub OAuth only. Email/password
sign-up is disabled. Supabase owns authenticated users, identities, sessions,
and refresh tokens. Cloudberry-specific profile data lives in
`public.profiles`.

## Hosted setup (no Docker)

Docker is not required when using a hosted Supabase project.

1. Open the Supabase dashboard for your project.
2. Enable Google and GitHub under Authentication > Providers.
3. Disable the Email provider or email sign-ups.
4. Set the Site URL to the URL where the Next.js app runs.
5. Add the app callback URL to the redirect allowlist:
   `http://localhost:3000/auth/callback`.
6. Copy the hosted project URL and publishable key into
   `apps/app/.env.local`.
7. Apply the migrations using the Supabase SQL Editor, in filename order.

For a deployed app, also add its HTTPS callback URL to the redirect allowlist.

The Google and GitHub OAuth applications must use the Supabase Auth callback
URL, not the Next.js callback URL:

`https://<project-ref>.supabase.co/auth/v1/callback`

If you prefer the CLI for hosted migrations, link the project and push the
migration files. This does not require Docker:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

## Optional local setup

Use this only when you want to run a local Supabase database and Auth service:

```bash
supabase start
supabase db reset
```

Local provider credentials are read by `supabase/config.toml`. The local OAuth
callback URL is:

`http://127.0.0.1:54321/auth/v1/callback`
