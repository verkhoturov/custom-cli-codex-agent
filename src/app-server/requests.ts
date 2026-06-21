import type { RpcRequest } from './protocol.js';

export interface UserInputOption {
  label: string;
}

export interface UserInputQuestion {
  id: string;
  options: UserInputOption[];
  prompt: string;
}

export type AppServerRequest =
  | { type: 'commandApproval'; command: string; reason: string }
  | { type: 'fileApproval'; reason: string }
  | { type: 'mcpElicitation'; message: string }
  | { type: 'permissionApproval'; permissions: Record<string, unknown>; reason: string }
  | { type: 'userInput'; questions: UserInputQuestion[] };

export function decodeAppServerRequest(request: RpcRequest): AppServerRequest | undefined {
  const params = asRecord(request.params);

  switch (request.method) {
    case 'item/commandExecution/requestApproval':
      return {
        command: stringValue(params.command) || 'unknown command',
        reason: stringValue(params.reason),
        type: 'commandApproval',
      };
    case 'item/fileChange/requestApproval':
      return {
        reason: stringValue(params.reason) || 'write outside the current sandbox boundary',
        type: 'fileApproval',
      };
    case 'item/permissions/requestApproval':
      return {
        permissions: asRecord(params.permissions),
        reason: stringValue(params.reason) || 'additional permissions requested',
        type: 'permissionApproval',
      };
    case 'item/tool/requestUserInput':
      return {
        questions: Array.isArray(params.questions)
          ? params.questions.map(decodeUserInputQuestion)
          : [],
        type: 'userInput',
      };
    case 'mcpServer/elicitation/request':
      return {
        message: stringValue(params.message) || 'MCP server requests user confirmation',
        type: 'mcpElicitation',
      };
    default:
      return undefined;
  }
}

function decodeUserInputQuestion(value: unknown): UserInputQuestion {
  const question = asRecord(value);
  return {
    id: stringValue(question.id),
    options: Array.isArray(question.options)
      ? question.options.map(option => ({ label: stringValue(asRecord(option).label) }))
      : [],
    prompt: stringValue(question.question) || stringValue(question.header) || 'Input required',
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
