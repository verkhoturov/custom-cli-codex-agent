import type { AppServerClient } from '../app-server/client.js';
import { resumeThread } from '../app-server/session.js';
import { type CliState, isReasoningEffort, isSandboxMode, type ReasoningEffort } from '../types.js';
import { printStatus, printWelcome } from './session-output.js';
import type { Terminal } from './terminal.js';

export type CommandResult = 'continue' | 'exit';

export interface CommandContext {
  client: AppServerClient;
  state: CliState;
  terminal: Terminal;
}

interface CliCommand {
  description: string;
  execute(context: CommandContext, args: string[]): CommandResult | Promise<CommandResult>;
  names: readonly [string, ...string[]];
  usage: string;
}

const COMMANDS: CliCommand[] = [
  {
    description: 'Show commands',
    execute: showHelp,
    names: ['/help'],
    usage: '/help',
  },
  {
    description: 'Start a new Codex thread',
    execute: startNewThread,
    names: ['/new'],
    usage: '/new',
  },
  {
    description: 'Resume a saved Codex thread',
    execute: resumeSavedThread,
    names: ['/resume'],
    usage: '/resume <thread-id>',
  },
  {
    description: 'Show current configuration',
    execute: showStatus,
    names: ['/status'],
    usage: '/status',
  },
  {
    description: 'Show or change model and reasoning effort',
    execute: changeModel,
    names: ['/model'],
    usage: '/model [model] [effort]',
  },
  {
    description: 'Show or set read-only/workspace-write',
    execute: changePermissions,
    names: ['/permissions'],
    usage: '/permissions [mode]',
  },
  {
    description: 'Clear the screen and start a new thread',
    execute: clearConversation,
    names: ['/clear'],
    usage: '/clear',
  },
  {
    description: 'Exit the CLI',
    execute: () => 'exit',
    names: ['/exit', '/quit'],
    usage: '/exit',
  },
];

const COMMAND_BY_NAME = new Map(
  COMMANDS.flatMap(command => command.names.map(name => [name, command])),
);

export async function handleCommand(
  input: string,
  context: CommandContext,
): Promise<CommandResult> {
  const [name, ...args] = input.trim().split(/\s+/);
  const command = name ? COMMAND_BY_NAME.get(name) : undefined;
  if (!command) {
    context.terminal.write(`Unknown command: ${name || input}. Run /help.\n`);
    return 'continue';
  }
  return command.execute(context, args);
}

export function commandHelp(): string {
  const usageWidth = Math.max(...COMMANDS.map(command => command.usage.length)) + 2;
  return COMMANDS.map(command => `${command.usage.padEnd(usageWidth)}${command.description}`).join(
    '\n',
  );
}

function showHelp({ terminal }: CommandContext): CommandResult {
  terminal.write(`${commandHelp()}\n`);
  return 'continue';
}

function startNewThread({ state, terminal }: CommandContext): CommandResult {
  resetThread(state);
  terminal.write('Started a new conversation.\n');
  return 'continue';
}

async function resumeSavedThread(
  { client, state, terminal }: CommandContext,
  args: string[],
): Promise<CommandResult> {
  const threadId = args.join(' ').trim();
  if (!threadId) {
    terminal.write(
      `Usage: /resume <thread-id>${state.threadId ? `\nCurrent: ${state.threadId}` : ''}\n`,
    );
    return 'continue';
  }
  await resumeThread(client, state, threadId);
  state.tokenUsage = undefined;
  terminal.write(`Resumed Codex thread ${state.threadId}.\n`);
  return 'continue';
}

function showStatus({ state, terminal }: CommandContext): CommandResult {
  printStatus(terminal, state);
  return 'continue';
}

function changeModel({ state, terminal }: CommandContext, args: string[]): CommandResult {
  if (args.length === 0) {
    terminal.write(`Model: ${state.model} (reasoning: ${state.reasoningEffort})\n`);
    return 'continue';
  }
  const settings = parseModelSettings(args);
  if (!settings) {
    terminal.write('Usage: /model <model> [none|minimal|low|medium|high|xhigh]\n');
    return 'continue';
  }
  state.model = settings.model;
  if (settings.effort) {
    state.reasoningEffort = settings.effort;
  }
  resetThread(state);
  terminal.write(
    `Model changed to ${state.model} (${state.reasoningEffort}). Started a new conversation.\n`,
  );
  return 'continue';
}

function changePermissions({ state, terminal }: CommandContext, args: string[]): CommandResult {
  const mode = args.join(' ').trim();
  if (!mode) {
    terminal.write(`Sandbox: ${state.sandbox}; approvals: ${state.approvalPolicy}\n`);
    return 'continue';
  }
  if (!isSandboxMode(mode)) {
    terminal.write('Usage: /permissions <read-only|workspace-write>\n');
    return 'continue';
  }
  state.sandbox = mode;
  resetThread(state);
  terminal.write(`Sandbox changed to ${mode}. Started a new conversation.\n`);
  return 'continue';
}

function clearConversation({ state, terminal }: CommandContext): CommandResult {
  terminal.clear();
  resetThread(state);
  printWelcome(terminal, state);
  return 'continue';
}

function resetThread(state: CliState): void {
  state.threadId = undefined;
  state.tokenUsage = undefined;
}

interface ModelSettings {
  effort?: ReasoningEffort;
  model: string;
}

function parseModelSettings(args: string[]): ModelSettings | undefined {
  const [model, effort] = args;
  if (!model || args.length > 2) {
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
