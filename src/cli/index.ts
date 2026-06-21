import type { AppServerClient } from '../app-server/client.js';
import type { CliState } from '../types.js';
import { checkCodexCli } from './check-codex-cli.js';
import { getErrorMessage, printWelcome } from './common.js';
import { handleCommand } from './handle-command.js';
import { handleServerRequest } from './handle-server-request.js';
import { PromptQueue } from './prompt-queue.js';
import { printSessionSummary } from './session-summary.js';
import { NodeTerminal, type Terminal } from './terminal.js';
import { TurnRunner } from './turn-runner.js';

export { checkCodexCli };

export async function runCli(
  state: CliState,
  client: AppServerClient,
  terminal: Terminal = new NodeTerminal(),
): Promise<void> {
  let exiting = false;
  const promptQueue = new PromptQueue();
  const turnRunner = new TurnRunner(state, client, terminal);

  client.setServerRequestHandler(request =>
    promptQueue.run(() => handleServerRequest(request, terminal, turnRunner.workingIndicator)),
  );

  const unsubscribeInterrupt = terminal.onInterrupt(() => {
    if (turnRunner.interrupt()) {
      return;
    }

    exiting = true;
    terminal.close();
  });

  printWelcome(terminal, state);

  try {
    while (!exiting) {
      let input: string;
      try {
        input = (await terminal.question('\nyou> ')).trim();
      } catch {
        break;
      }

      if (!input) {
        continue;
      }

      if (input.startsWith('/')) {
        const result = await handleCommand(input, { client, state, terminal });
        if (result === 'exit') {
          break;
        }
        continue;
      }

      try {
        await turnRunner.run(input);
      } catch (error) {
        terminal.writeError(`\nError: ${getErrorMessage(error)}\n`);
      }
    }
  } finally {
    unsubscribeInterrupt();
    terminal.close();
    printSessionSummary(terminal, state.tokenUsage, state.threadId);
  }
}
