import { spawnSync } from 'node:child_process';

import { ensureCodexHome } from '../utils/codex-home.js';
import type { Terminal } from './terminal.js';

const CREDENTIAL_STORE_OVERRIDE = 'cli_auth_credentials_store="file"';

type AuthenticationMethod = 'api-key' | 'browser' | 'device-code' | 'access-token';

interface AuthenticationSelection {
  credential?: string;
  method: AuthenticationMethod;
}

export async function ensureCodexAuthentication(
  codexHome: string,
  terminal: Terminal,
  forceLogin: boolean,
): Promise<string> {
  ensureCodexHome(codexHome);

  const savedAuthentication = readLoginStatus(codexHome);
  if (savedAuthentication && !forceLogin) {
    return savedAuthentication;
  }

  if (savedAuthentication) {
    terminal.write(`Current authentication: ${savedAuthentication}\n`);
  } else {
    terminal.write('No saved Codex authentication found.\n');
  }

  const selection = await promptForAuthentication(terminal);
  terminal.close();
  runCodexLogin(codexHome, selection);

  const updatedAuthentication = readLoginStatus(codexHome);
  if (!updatedAuthentication) {
    throw new Error('Codex CLI did not save authentication');
  }

  return updatedAuthentication;
}

export function logoutCodex(codexHome: string): string {
  const result = spawnSync('codex', ['logout', '-c', CREDENTIAL_STORE_OVERRIDE], {
    encoding: 'utf8',
    env: codexEnvironment(codexHome),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Unable to log out of Codex');
  }

  return result.stdout.trim() || result.stderr.trim() || 'Logged out';
}

async function promptForAuthentication(terminal: Terminal): Promise<AuthenticationSelection> {
  terminal.write(`Choose a Codex authentication method:
  1. Sign in with ChatGPT in a browser
  2. Sign in with ChatGPT using a device code
  3. OpenAI API key
  4. ChatGPT access token
`);

  while (true) {
    const answer = (await terminal.question('Authentication method [1]: ')).trim() || '1';

    if (answer === '1') {
      return { method: 'browser' };
    }
    if (answer === '2') {
      return { method: 'device-code' };
    }
    if (answer === '3') {
      return {
        credential: await requireSecret(terminal, 'OpenAI API key: '),
        method: 'api-key',
      };
    }
    if (answer === '4') {
      return {
        credential: await requireSecret(terminal, 'ChatGPT access token: '),
        method: 'access-token',
      };
    }

    terminal.write('Enter 1, 2, 3, or 4.\n');
  }
}

async function requireSecret(terminal: Terminal, prompt: string): Promise<string> {
  const secret = (await terminal.questionSecret(prompt)).trim();
  if (!secret) {
    throw new Error('Authentication credential is required');
  }
  return secret;
}

function readLoginStatus(codexHome: string): string | undefined {
  const result = spawnSync('codex', ['login', '-c', CREDENTIAL_STORE_OVERRIDE, 'status'], {
    encoding: 'utf8',
    env: codexEnvironment(codexHome),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    return result.stdout.trim() || result.stderr.trim() || 'logged in';
  }
  if (result.status === 1 && result.stderr.trim() === 'Not logged in') {
    return undefined;
  }

  throw new Error(result.stderr.trim() || 'Unable to check Codex authentication');
}

function runCodexLogin(codexHome: string, selection: AuthenticationSelection): void {
  const args = ['login', '-c', CREDENTIAL_STORE_OVERRIDE];
  if (selection.method === 'device-code') {
    args.push('--device-auth');
  } else if (selection.method === 'api-key') {
    args.push('--with-api-key');
  } else if (selection.method === 'access-token') {
    args.push('--with-access-token');
  }

  const usesCredential = selection.credential !== undefined;
  const result = spawnSync('codex', args, {
    encoding: 'utf8',
    env: codexEnvironment(codexHome),
    input: usesCredential ? `${selection.credential}\n` : undefined,
    stdio: usesCredential ? ['pipe', 'inherit', 'inherit'] : 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error('Codex authentication was cancelled or failed');
  }
}

function codexEnvironment(codexHome: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CODEX_HOME: codexHome,
  };
}
