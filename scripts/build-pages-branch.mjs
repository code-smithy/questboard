import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';

const requiredVariables = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim());

if (missingVariables.length > 0) {
  console.error(
    `Refusing to build the committed Pages fallback without ${missingVariables.join(', ')}. ` +
      'That would create a /dist/ fallback where Discord login says Supabase is not configured.',
  );
  console.error('Export the same Supabase values used by the GitHub Pages workflow, then rerun npm run build:pages-branch.');
  process.exit(1);
}

const result = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    VITE_BASE_PATH: './',
    VITE_BRANCH_FALLBACK: '1',
  },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (existsSync('dist/favicon.png')) {
  rmSync('dist/favicon.png');
}

writeFileSync('dist/.nojekyll', '');
