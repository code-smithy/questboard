import { spawnSync } from 'node:child_process';

const forbiddenPrefixes = ['dist/', '.tmp-vite-build/'];
const forbiddenSuffixes = ['.tsbuildinfo'];

const result = spawnSync('git', ['ls-files', ...forbiddenPrefixes, '*.tsbuildinfo'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || 'Unable to inspect tracked build artifacts.\n');
  process.exit(result.status ?? 1);
}

const trackedArtifacts = result.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((path) => forbiddenPrefixes.some((prefix) => path.startsWith(prefix)) || forbiddenSuffixes.some((suffix) => path.endsWith(suffix)));

if (trackedArtifacts.length > 0) {
  console.error('Generated build artifacts are tracked and must not be committed:');
  for (const path of trackedArtifacts) {
    console.error(`- ${path}`);
  }
  console.error('Remove them from git with: git rm -r --cached dist .tmp-vite-build 2>/dev/null || true');
  process.exit(1);
}
