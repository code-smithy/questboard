# Questboard agent instructions

## Critical deployment rule

Do **not** commit generated Vite output (`dist/`, `.tmp-vite-build/`, or `*.tsbuildinfo`). The live site is deployed by GitHub Actions from a fresh build with repository/environment variables.

Why this matters: Vite replaces `import.meta.env.VITE_*` at build time. If an agent runs `npm run build` without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the generated bundle bakes in an unconfigured Supabase client and users see "Discord login is not configured yet" even though repository config did not change.

Before committing any code change:

1. Run `git status --short`.
2. If `dist/` appears, remove it from the commit (`git rm -r --cached dist` if tracked, or `rm -rf dist` if untracked) unless the user explicitly asked for a branch-source fallback build.
3. Run `npm run verify:no-committed-build`.
4. Never use `git add -f dist` unless the user explicitly provides production Supabase values and asks for a committed fallback build.

## GitHub Pages deployment guardrails

GitHub Pages must serve the GitHub Actions artifact built from `dist/`, not the repository branch source. A broken Pages setting can serve the raw root `index.html`, causing the live site to request `/src/main.tsx` or expose `%BASE_URL%` instead of loading the built Vite bundle.

When touching `.github/workflows/deploy-pages.yml`, `docs/github-pages.md`, `index.html`, Vite config, or deployment-related scripts:

1. Preserve the Actions artifact deployment path (`actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`).
2. Preserve a fail-fast guard that verifies Pages `build_type` is `workflow` before deployment. Do not allow the workflow to continue to upload/deploy if GitHub rejects the settings update; instead direct maintainers to **Settings → Pages → Build and deployment → Source = GitHub Actions** or a `PAGES_ADMIN_TOKEN` secret with permission to manage Pages settings.
3. Preserve the live deployment check for raw source markers (`%BASE_URL%` and `/src/main.tsx`). Do not weaken this check to accept a branch-source deployment.
4. Treat live deployment failures that still serve raw source as a repository Pages settings issue, not as a Supabase, Discord OAuth, React Router, or Vite application bug.

## Post-commit pickup verification

After committing any change, verify the latest commit contains the intended files before reporting completion. At minimum run `git show --stat --oneline HEAD` and confirm the expected paths are listed. If a user says a PR, branch, or repository view did not pick up a change, re-run that command plus `git log --oneline -3` and report the exact latest commit hash and changed files.
