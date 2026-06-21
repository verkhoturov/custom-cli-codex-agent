#!/usr/bin/env node

import { CodexAppServerClient } from './app-server/client.js';
import { ensureCodexAuthentication, logoutCodex } from './cli/authentication.js';
import { runCli } from './cli/index.js';
import { NodeTerminal } from './cli/terminal.js';
import { usage } from './config.js';
import { checkCodexCli } from './utils/check-codex-cli.js';
import { parseArgs } from './utils/cli-arguments.js';

async function main(): Promise<void> {
  const { forceLogin, help, resumeThreadId, state } = parseArgs(process.argv.slice(2));

  if (help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const codexVersion = checkCodexCli();

  let terminal = new NodeTerminal();
  let authentication: string;
  try {
    authentication = await ensureCodexAuthentication(state.codexHome, terminal, forceLogin);
  } finally {
    terminal.close();
  }
  terminal = new NodeTerminal();
  terminal.write(
    `Using ${codexVersion}\nAuthentication: ${authentication}\n\nConnecting to Codex app-server...\n`,
  );

  const appServer = new CodexAppServerClient({
    codexHome: state.codexHome,
    cwd: state.cwd,
  });

  let logout = false;
  try {
    await appServer.connect();
    logout = (await runCli(state, appServer, terminal, resumeThreadId)) === 'logout';
  } finally {
    terminal.close();
    await appServer.close();
  }

  if (logout) {
    terminal.write(`${logoutCodex(state.codexHome)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
