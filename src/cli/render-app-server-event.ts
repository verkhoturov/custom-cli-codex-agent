import type { RpcNotification, ThreadItem } from '../app-server/protocol.js';

type OpenLine = 'answer' | 'command' | 'reasoning';

export interface AppServerOutputState {
  beforeWrite?: () => void;
  changedFiles: Set<string>;
  errorDisplayed: boolean;
  openLine?: OpenLine;
  streamedText: boolean;
}

export function createAppServerOutputState(beforeWrite?: () => void): AppServerOutputState {
  return { beforeWrite, changedFiles: new Set(), errorDisplayed: false, streamedText: false };
}

export function renderAppServerNotification(
  notification: RpcNotification,
  output: AppServerOutputState,
): void {
  const params = asRecord(notification.params);

  switch (notification.method) {
    case 'item/reasoning/summaryTextDelta':
      renderDelta(output, 'reasoning', '[reasoning] ', params.delta);
      return;

    case 'item/agentMessage/delta':
      if (renderDelta(output, 'answer', 'agent> ', params.delta)) {
        output.streamedText = true;
      }
      return;

    case 'item/commandExecution/outputDelta':
      renderDelta(output, 'command', '', params.delta);
      return;

    case 'item/fileChange/patchUpdated':
      renderFileChanges(output, params.changes);
      return;

    case 'item/started':
      renderItemStarted(output, params.item);
      return;

    case 'item/completed':
      renderItemCompleted(output, params.item);
      return;

    case 'error': {
      const error = asRecord(params.error);
      closeOpenLine(output);
      write(output, `[error] ${stringValue(error.message) || 'Codex turn failed'}\n`);
      output.errorDisplayed = true;
      return;
    }

    case 'warning':
    case 'configWarning':
      closeOpenLine(output);
      write(output, `[warning] ${stringValue(params.message) || 'Codex warning'}\n`);
  }
}

export function finishAppServerOutput(output: AppServerOutputState): void {
  closeOpenLine(output);
}

function renderItemStarted(output: AppServerOutputState, value: unknown): void {
  const item = value as ThreadItem | undefined;
  if (!item) {
    return;
  }

  switch (item.type) {
    case 'commandExecution':
      closeOpenLine(output);
      write(output, `[command] ${item.command || 'shell command'}\n`);
      return;

    case 'mcpToolCall':
      closeOpenLine(output);
      write(output, `[mcp] ${item.server || 'server'}/${item.tool || 'tool'}\n`);
      return;

    case 'webSearch':
      closeOpenLine(output);
      write(output, `[web search] ${item.query || ''}\n`);
      return;

    case 'fileChange':
      renderFileChanges(output, item.changes);
  }
}

function renderItemCompleted(output: AppServerOutputState, value: unknown): void {
  const item = value as ThreadItem | undefined;
  if (!item) {
    return;
  }

  if (item.type === 'commandExecution') {
    closeLine(output, 'command');
    if (typeof item.exitCode === 'number' && item.exitCode !== 0) {
      write(output, `[command failed] exit=${item.exitCode}\n`);
    }
  }
}

function renderFileChanges(output: AppServerOutputState, value: unknown): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const change of value) {
    const record = asRecord(change);
    const path = stringValue(record.path);
    if (!path || output.changedFiles.has(path)) {
      continue;
    }
    output.changedFiles.add(path);
    closeOpenLine(output);
    write(output, `[file ${changeKind(record.kind)}] ${path}\n`);
  }
}

function renderDelta(
  output: AppServerOutputState,
  line: OpenLine,
  prefix: string,
  value: unknown,
): boolean {
  const delta = stringValue(value);
  if (!delta) {
    return false;
  }

  openLine(output, line, prefix);
  write(output, delta);
  return true;
}

function openLine(output: AppServerOutputState, line: OpenLine, prefix: string): void {
  if (output.openLine === line) {
    return;
  }

  closeOpenLine(output);
  if (prefix) {
    write(output, prefix);
  }
  output.openLine = line;
}

function closeLine(output: AppServerOutputState, line: OpenLine): void {
  if (output.openLine === line) {
    closeOpenLine(output);
  }
}

function closeOpenLine(output: AppServerOutputState): void {
  if (output.openLine) {
    write(output, '\n');
    output.openLine = undefined;
  }
}

function write(output: AppServerOutputState, value: string): void {
  output.beforeWrite?.();
  process.stdout.write(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function changeKind(value: unknown): string {
  const type = stringValue(asRecord(value).type);
  return type || 'update';
}
