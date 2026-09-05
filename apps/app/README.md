# Cloudberry app

Cloudberry uses hosted Supabase Auth with Google and GitHub OAuth only.
Email/password sign-up is not part of the application authentication flow.

## Hosted Supabase setup

1. Create `.env.local` in this directory using the private deployment
   configuration.
2. Set the hosted Supabase project URL and publishable key.
4. Configure Google and GitHub in the Supabase dashboard.
5. Add the app callback URL to the Supabase redirect allowlist:
   `http://localhost:3000/auth/callback`.
6. Run the app with `bun run dev`.

The OAuth sign-up page is `/signup`. After a successful Google or GitHub
OAuth flow, users are redirected to `/`.

The external OAuth providers must use the Supabase Auth callback URL described
in `supabase/README.md`. Docker and `supabase start` are not required for the
hosted project.
