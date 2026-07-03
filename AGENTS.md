# Questboard agent instructions

## Critical deployment rule

Do **not** commit generated Vite output (`dist/`, `.tmp-vite-build/`, or `*.tsbuildinfo`). The live site is deployed by GitHub Actions from a fresh build with repository/environment variables.

Why this matters: Vite replaces `import.meta.env.VITE_*` at build time. If an agent runs `npm run build` without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the generated bundle bakes in an unconfigured Supabase client and users see "Discord login is not configured yet" even though repository config did not change.

Before committing any code change:

1. Run `git status --short`.
2. If `dist/` appears, remove it from the commit (`git rm -r --cached dist` if tracked, or `rm -rf dist` if untracked) unless the user explicitly asked for a branch-source fallback build.
3. Run `npm run verify:no-committed-build`.
4. Never use `git add -f dist` unless the user explicitly provides production Supabase values and asks for a committed fallback build.
