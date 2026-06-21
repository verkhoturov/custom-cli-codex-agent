import type { RpcRequest } from '../../app-server/protocol.js';
import {
  type AppServerRequest,
  decodeAppServerRequest,
  type UserInputQuestion,
} from '../../app-server/requests.js';
import type { Terminal } from '../terminal.js';
import type { WorkingIndicator } from '../turn/working-indicator.js';

export async function handleServerRequest(
  request: RpcRequest,
  terminal: Terminal,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  const decoded = decodeAppServerRequest(request);
  if (!decoded) {
    throw new Error(`Unsupported app-server request: ${request.method}`);
  }

  switch (decoded.type) {
    case 'commandApproval':
      return handleCommandApproval(decoded, terminal, working);

    case 'fileApproval':
      return handleFileApproval(decoded, terminal, working);

    case 'permissionApproval':
      return handlePermissionApproval(decoded, terminal, working);

    case 'userInput':
      return handleUserInput(decoded.questions, terminal, working);

    case 'mcpElicitation':
      return handleMcpElicitation(decoded, terminal, working);

    default:
      return assertNever(decoded);
  }
}

async function handleCommandApproval(
  request: Extract<AppServerRequest, { type: 'commandApproval' }>,
  terminal: Terminal,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  terminal.write(`\nApproval required for command:\n${request.command}\n`);
  if (request.reason) {
    terminal.write(`Reason: ${request.reason}\n`);
  }
  const answer = await askChoice(terminal, working, 'Approve? [y]es/[a]ll session/[N]o: ');
  const decision = answer === 'a' ? 'acceptForSession' : answer === 'y' ? 'accept' : 'decline';
  return { decision };
}

async function handleFileApproval(
  request: Extract<AppServerRequest, { type: 'fileApproval' }>,
  terminal: Terminal,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  terminal.write(`\nApproval required for file changes: ${request.reason}\n`);
  const answer = await askChoice(terminal, working, 'Approve? [y]es/[a]ll session/[N]o: ');
  const decision = answer === 'a' ? 'acceptForSession' : answer === 'y' ? 'accept' : 'decline';
  return { decision };
}

async function handlePermissionApproval(
  request: Extract<AppServerRequest, { type: 'permissionApproval' }>,
  terminal: Terminal,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  terminal.write(`\nPermission request: ${request.reason}\n`);
  const answer = await askChoice(terminal, working, 'Grant for this turn? [y/N]: ');
  return {
    permissions: answer === 'y' ? request.permissions : {},
    scope: 'turn',
  };
}

async function handleUserInput(
  questions: UserInputQuestion[],
  terminal: Terminal,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  const answers: Record<string, { answers: string[] }> = {};

  for (const question of questions) {
    if (question.options.length > 0) {
      terminal.write(`\n${question.prompt}\n`);
      question.options.forEach((option, index) => {
        terminal.write(`  ${index + 1}. ${option.label}\n`);
      });
    }
    const answer = await askText(
      terminal,
      working,
      `${question.options.length > 0 ? 'Choice' : question.prompt}: `,
    );
    const selected = Number.parseInt(answer, 10);
    const selectedOption = Number.isNaN(selected) ? undefined : question.options[selected - 1];
    if (question.id) {
      answers[question.id] = { answers: [selectedOption?.label || answer] };
    }
  }

  return { answers };
}

async function handleMcpElicitation(
  request: Extract<AppServerRequest, { type: 'mcpElicitation' }>,
  terminal: Terminal,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  terminal.write(`\n${request.message}\n`);
  const answer = await askChoice(terminal, working, 'Accept? [y/N]: ');
  return { _meta: null, action: answer === 'y' ? 'accept' : 'decline', content: null };
}

async function askText(
  terminal: Terminal,
  working: WorkingIndicator | undefined,
  prompt: string,
): Promise<string> {
  working?.hide();
  try {
    return (await terminal.question(prompt)).trim();
  } finally {
    working?.show();
  }
}

async function askChoice(
  terminal: Terminal,
  working: WorkingIndicator | undefined,
  prompt: string,
): Promise<string> {
  return (await askText(terminal, working, prompt)).toLowerCase();
}

function assertNever(value: never): never {
  throw new Error(`Unhandled app-server request: ${JSON.stringify(value)}`);
}
