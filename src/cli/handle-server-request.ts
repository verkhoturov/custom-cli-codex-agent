import type { Interface } from 'node:readline/promises';

import type { RpcRequest } from '../app-server/protocol.js';
import type { WorkingIndicator } from './working-indicator.js';

export async function handleServerRequest(
  request: RpcRequest,
  readline: Interface,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  switch (request.method) {
    case 'item/commandExecution/requestApproval':
      return handleCommandApproval(request.params, readline, working);

    case 'item/fileChange/requestApproval':
      return handleFileApproval(request.params, readline, working);

    case 'item/permissions/requestApproval':
      return handlePermissionApproval(request.params, readline, working);

    case 'item/tool/requestUserInput':
      return handleUserInput(request.params, readline, working);

    case 'mcpServer/elicitation/request':
      return handleMcpElicitation(request.params, readline, working);

    default:
      throw new Error(`Unsupported app-server request: ${request.method}`);
  }
}

async function handleCommandApproval(
  value: unknown,
  readline: Interface,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  const params = asRecord(value);
  const command = stringValue(params.command) || 'unknown command';
  const reason = stringValue(params.reason);
  process.stdout.write(`\nApproval required for command:\n${command}\n`);
  if (reason) {
    process.stdout.write(`Reason: ${reason}\n`);
  }
  const answer = await ask(readline, working, 'Approve? [y]es/[a]ll session/[N]o: ');
  const decision = answer === 'a' ? 'acceptForSession' : answer === 'y' ? 'accept' : 'decline';
  return { decision };
}

async function handleFileApproval(
  value: unknown,
  readline: Interface,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  const params = asRecord(value);
  const reason = stringValue(params.reason) || 'write outside the current sandbox boundary';
  process.stdout.write(`\nApproval required for file changes: ${reason}\n`);
  const answer = await ask(readline, working, 'Approve? [y]es/[a]ll session/[N]o: ');
  const decision = answer === 'a' ? 'acceptForSession' : answer === 'y' ? 'accept' : 'decline';
  return { decision };
}

async function handlePermissionApproval(
  value: unknown,
  readline: Interface,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  const params = asRecord(value);
  const reason = stringValue(params.reason) || 'additional permissions requested';
  process.stdout.write(`\nPermission request: ${reason}\n`);
  const answer = await ask(readline, working, 'Grant for this turn? [y/N]: ');
  return {
    permissions: answer === 'y' ? asRecord(params.permissions) : {},
    scope: 'turn',
  };
}

async function handleUserInput(
  value: unknown,
  readline: Interface,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  const params = asRecord(value);
  const questions = Array.isArray(params.questions) ? params.questions : [];
  const answers: Record<string, { answers: string[] }> = {};

  for (const value of questions) {
    const question = asRecord(value);
    const id = stringValue(question.id);
    const prompt =
      stringValue(question.question) || stringValue(question.header) || 'Input required';
    const options = Array.isArray(question.options) ? question.options : [];
    if (options.length > 0) {
      process.stdout.write(`\n${prompt}\n`);
      options.forEach((option, index) => {
        const record = asRecord(option);
        process.stdout.write(`  ${index + 1}. ${stringValue(record.label)}\n`);
      });
    }
    const answer = await ask(readline, working, `${options.length > 0 ? 'Choice' : prompt}: `);
    const selected = Number.parseInt(answer, 10);
    const selectedOption = Number.isNaN(selected) ? undefined : options[selected - 1];
    const selectedLabel = selectedOption ? stringValue(asRecord(selectedOption).label) : answer;
    if (id) {
      answers[id] = { answers: [selectedLabel] };
    }
  }

  return { answers };
}

async function handleMcpElicitation(
  value: unknown,
  readline: Interface,
  working: WorkingIndicator | undefined,
): Promise<unknown> {
  const params = asRecord(value);
  const message = stringValue(params.message) || 'MCP server requests user confirmation';
  process.stdout.write(`\n${message}\n`);
  const answer = await ask(readline, working, 'Accept? [y/N]: ');
  return { _meta: null, action: answer === 'y' ? 'accept' : 'decline', content: null };
}

async function ask(
  readline: Interface,
  working: WorkingIndicator | undefined,
  prompt: string,
): Promise<string> {
  working?.hide();
  try {
    return (await readline.question(prompt)).trim().toLowerCase();
  } finally {
    working?.show();
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
