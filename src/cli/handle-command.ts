import type { CodexAppServerClient } from '../app-server/client.js';
import { resumeThread } from '../app-server/session.js';
import { type CliState, isReasoningEffort, isSandboxMode, type ReasoningEffort } from '../types.js';
import { printStatus, printWelcome } from './common.js';

const COMMANDS = `/help                         Show commands
/new                          Start a new Codex thread
/resume <thread-id>           Resume a saved Codex thread
/status                       Show current configuration
/model [model] [effort]       Show or change model and reasoning effort
/permissions [mode]           Show or set read-only/workspace-write
/clear                        Clear the screen and start a new thread
/exit                         Exit the CLI`;

export async function handleCommand(
  input: string,
  state: CliState,
  client: CodexAppServerClient,
): Promise<boolean> {
  const [command, ...argumentsList] = input.split(/\s+/);
  const argument = argumentsList.join(' ').trim();

  switch (command) {
    case '/help':
      process.stdout.write(`${COMMANDS}\n`);
      return false;

    case '/new':
      resetThread(state);
      process.stdout.write('Started a new conversation.\n');
      return false;

    case '/resume':
      if (!argument) {
        process.stdout.write(
          `Usage: /resume <thread-id>${state.threadId ? `\nCurrent: ${state.threadId}` : ''}\n`,
        );
        return false;
      }
      await resumeThread(client, state, argument);
      state.tokenUsage = undefined;
      process.stdout.write(`Resumed Codex thread ${state.threadId}.\n`);
      return false;

    case '/status':
      printStatus(state);
      return false;

    case '/model': {
      if (!argument) {
        process.stdout.write(`Model: ${state.model} (reasoning: ${state.reasoningEffort})\n`);
        return false;
      }
      const settings = parseModelSettings(argumentsList);
      if (!settings) {
        process.stdout.write('Usage: /model <model> [none|minimal|low|medium|high|xhigh]\n');
        return false;
      }
      state.model = settings.model;
      if (settings.effort) {
        state.reasoningEffort = settings.effort;
      }
      resetThread(state);
      process.stdout.write(
        `Model changed to ${state.model} (${state.reasoningEffort}). Started a new conversation.\n`,
      );
      return false;
    }

    case '/permissions':
      if (!argument) {
        process.stdout.write(`Sandbox: ${state.sandbox}; approvals: ${state.approvalPolicy}\n`);
        return false;
      }
      if (!isSandboxMode(argument)) {
        process.stdout.write('Usage: /permissions <read-only|workspace-write>\n');
        return false;
      }
      state.sandbox = argument;
      resetThread(state);
      process.stdout.write(`Sandbox changed to ${argument}. Started a new conversation.\n`);
      return false;

    case '/clear':
      console.clear();
      resetThread(state);
      printWelcome(state);
      return false;

    case '/exit':
    case '/quit':
      return true;

    default:
      process.stdout.write(`Unknown command: ${command}. Run /help.\n`);
      return false;
  }
}

function resetThread(state: CliState): void {
  state.threadId = undefined;
  state.tokenUsage = undefined;
}

interface ModelSettings {
  effort?: ReasoningEffort;
  model: string;
}

function parseModelSettings(argumentsList: string[]): ModelSettings | undefined {
  const [model, effort] = argumentsList;
  if (!model || argumentsList.length > 2) {
    return undefined;
  }
  let parsedEffort: ReasoningEffort | undefined;
  if (effort) {
    if (!isReasoningEffort(effort)) {
      return undefined;
    }
    parsedEffort = effort;
  }
  return { effort: parsedEffort, model };
}
