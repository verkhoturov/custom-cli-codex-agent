import { spawnSync } from 'node:child_process';

export function checkCodexCli(): string {
  const version = spawnSync('codex', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (version.error || version.status !== 0) {
    throw new Error('Codex CLI is not available. Install it and make sure `codex` is in PATH.');
  }

  return version.stdout.trim();
}
