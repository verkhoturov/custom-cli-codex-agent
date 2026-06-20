import type { CliState } from '../types.js';
import type { CodexAppServerClient } from './client.js';
import type { ThreadResumeResponse, ThreadStartResponse, TurnStartResponse } from './protocol.js';

const DEVELOPER_INSTRUCTIONS =
  'You are a software engineering agent focused on analyzing repositories, writing code, running commands, and explaining results clearly.';

export async function startThread(client: CodexAppServerClient, state: CliState): Promise<string> {
  const response = await client.request<ThreadStartResponse>('thread/start', {
    approvalPolicy: state.approvalPolicy,
    config: { model_reasoning_effort: state.reasoningEffort },
    cwd: state.cwd,
    developerInstructions: DEVELOPER_INSTRUCTIONS,
    ephemeral: false,
    model: state.model,
    sandbox: state.sandbox,
  });
  state.threadId = response.thread.id;
  return response.thread.id;
}

export async function resumeThread(
  client: CodexAppServerClient,
  state: CliState,
  threadId: string,
): Promise<string> {
  const response = await client.request<ThreadResumeResponse>('thread/resume', {
    approvalPolicy: state.approvalPolicy,
    config: { model_reasoning_effort: state.reasoningEffort },
    cwd: state.cwd,
    developerInstructions: DEVELOPER_INSTRUCTIONS,
    model: state.model,
    sandbox: state.sandbox,
    threadId,
  });
  state.threadId = response.thread.id;
  return response.thread.id;
}

export async function startTurn(
  client: CodexAppServerClient,
  state: CliState,
  input: string,
): Promise<string> {
  const threadId = state.threadId || (await startThread(client, state));
  const response = await client.request<TurnStartResponse>('turn/start', {
    approvalPolicy: state.approvalPolicy,
    cwd: state.cwd,
    effort: state.reasoningEffort,
    input: [{ text: input, text_elements: [], type: 'text' }],
    model: state.model,
    summary: 'auto',
    threadId,
  });
  return response.turn.id;
}

export async function interruptTurn(
  client: CodexAppServerClient,
  threadId: string,
  turnId: string,
): Promise<void> {
  await client.request('turn/interrupt', { threadId, turnId });
}
