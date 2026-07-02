# GitHub Pages Deployment

Questboard is a static Vite app and can be deployed to GitHub Pages with the included workflow at `.github/workflows/deploy-pages.yml`.

## Repository Settings

1. Open the GitHub repository settings.
2. Go to **Pages**.
3. Set **Build and deployment** to **GitHub Actions**.
4. Go to **Secrets and variables** → **Actions** → **Variables**.
5. Add these as repository variables, or open the `github-pages` environment and add them as environment variables. If your repository previously used branch-based Pages, verify this setting again after changing Pages settings because branch-based deploys serve `index.html` directly and leave `/src/main.tsx` unbuilt.

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-SUPABASE-PUBLISHABLE-KEY
# Only for a custom domain or user/organization page:
VITE_BASE_PATH=/
```

The workflow also accepts `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Actions secrets for repositories that prefer secret storage, but `VITE_BASE_PATH` must be an Actions variable. Use the project URL without `/rest/v1`; if that suffix is copied accidentally, the app normalizes it at runtime. The Supabase publishable key is designed to be used by browser clients, but keeping project-specific values in GitHub Actions variables avoids hard-coding one Supabase project into source control. The Pages workflow builds in the `github-pages` environment so environment-level variables are available during the Vite build.

The workflow also tries to switch the repository Pages build type to **GitHub Actions** through the GitHub Pages API before building. If that step emits a warning, set the Pages source manually; otherwise GitHub's branch-based `pages-build-deployment` workflow can publish the repository source `index.html`, which leaves the browser stuck on `Loading Questboard…` and tries to load `/src/main.tsx`.

## Deployment Cancellation

The workflow uses a per-branch concurrency group and cancels in-progress runs for the same branch when a newer commit starts. If GitHub Pages logs `Error: Deployment cancelled` for an older run after another push, treat the newer run as the authoritative deployment and rerun only the latest workflow if it did not complete.

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

If you use a custom domain or user/organization page, set this Actions variable so both automatic push deploys and manual reruns build the same asset paths:

```text
VITE_BASE_PATH=/
```
