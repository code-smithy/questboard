import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

function getGitHubPagesBase() {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH;
  }

  const repository = process.env.GITHUB_REPOSITORY;

  if (process.env.GITHUB_ACTIONS && repository) {
    const repositoryName = repository.split('/')[1];
    return `/${repositoryName}/`;
  }

  return '/';
}

export default defineConfig({
  base: getGitHubPagesBase(),
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
