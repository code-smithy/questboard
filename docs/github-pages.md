# GitHub Pages Deployment

Questboard is a static Vite app and can be deployed to GitHub Pages with the included workflow at `.github/workflows/deploy-pages.yml`.

## Repository Settings

1. Open the GitHub repository settings.
2. Go to **Pages**.
3. Set **Build and deployment** to **GitHub Actions**.
4. Go to **Secrets and variables** → **Actions** → **Variables**.
5. Add these repository variables:

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-SUPABASE-PUBLISHABLE-KEY
```

The Supabase publishable key is designed to be used by browser clients, but keeping project-specific values in GitHub Actions variables avoids hard-coding one Supabase project into source control.

## Supabase Redirect URL

After the first successful Pages deployment, copy the GitHub Pages URL and add it to Supabase Auth redirect URLs.

For a project page, the URL usually looks like:

```text
https://OWNER.github.io/REPOSITORY
```

For local development, also allow:

```text
http://localhost:5173
```

## Base Path

The Vite config automatically uses the repository name as the base path during GitHub Actions builds, which supports the normal project-pages URL shape:

```text
https://OWNER.github.io/REPOSITORY/
```

If you use a custom domain or user/organization page, set this Actions variable instead:

```text
VITE_BASE_PATH=/
```
