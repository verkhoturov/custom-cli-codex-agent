export type RequestId = number | string;

export interface RpcError {
  code: number;
  data?: unknown;
  message: string;
}

export interface RpcRequest {
  id: RequestId;
  method: string;
  params?: unknown;
}

export interface RpcNotification {
  method: string;
  params?: unknown;
}

export interface RpcResponse {
  error?: RpcError;
  id: RequestId;
  result?: unknown;
}

export type RpcMessage = RpcRequest | RpcNotification | RpcResponse;

export interface LoginAccountResponse {
  type: 'apiKey';
}

export interface GetAccountResponse {
  account: { type: 'apiKey' | 'amazonBedrock' | 'chatgpt' } | null;
  requiresOpenaiAuth: boolean;
}

export interface ThreadStartResponse {
  reasoningEffort: string | null;
  thread: { id: string };
}

export interface ThreadResumeResponse {
  thread: { id: string };
}

export interface TurnStartResponse {
  turn: { id: string };
}

export interface TokenUsageBreakdown {
  cachedInputTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}

export interface ThreadTokenUsage {
  last: TokenUsageBreakdown;
  modelContextWindow: number | null;
  total: TokenUsageBreakdown;
}

export interface ThreadItem {
  aggregatedOutput?: string | null;
  changes?: Array<{ diff: string; kind: unknown; path: string }>;
  command?: string;
  durationMs?: number | null;
  error?: unknown;
  exitCode?: number | null;
  id: string;
  query?: string;
  server?: string;
  status?: string;
  tool?: string;
  type: string;
}

export interface TurnCompletedParams {
  threadId: string;
  turn: {
    durationMs: number | null;
    error: { message?: string } | null;
    id: string;
    status: 'completed' | 'failed' | 'inProgress' | 'interrupted';
  };
}

export type ServerRequestHandler = (request: RpcRequest) => Promise<unknown>;

export type NotificationHandler = (notification: RpcNotification) => void;

export function isRpcRequest(message: RpcMessage): message is RpcRequest {
  return 'method' in message && 'id' in message;
}

export function isRpcNotification(message: RpcMessage): message is RpcNotification {
  return 'method' in message && !('id' in message);
}

export function isRpcResponse(message: RpcMessage): message is RpcResponse {
  return 'id' in message && !('method' in message);
}
