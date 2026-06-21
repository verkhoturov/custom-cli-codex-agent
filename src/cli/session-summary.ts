import type { ThreadTokenUsage } from '../app-server/protocol.js';
import type { Terminal } from './terminal.js';

const numberFormat = new Intl.NumberFormat('en-US');

export function printSessionSummary(
  terminal: Terminal,
  usage: ThreadTokenUsage | undefined,
  threadId: string | undefined,
): void {
  const totals = usage?.total;
  const cachedTokens = totals?.cachedInputTokens ?? 0;
  const inputTokens = totals?.inputTokens ?? 0;
  const outputTokens = totals?.outputTokens ?? 0;
  const totalTokens = totals?.totalTokens ?? 0;
  const cached = cachedTokens ? ` (+ ${formatNumber(cachedTokens)} cached)` : '';

  terminal.write(
    `\nToken usage: total=${formatNumber(totalTokens)} input=${formatNumber(inputTokens)}${cached} output=${formatNumber(outputTokens)}\n`,
  );

  if (threadId) {
    terminal.write(`To continue this session, run npm run codex -- resume ${threadId}\n`);
  }
}

function formatNumber(value: number): string {
  return numberFormat.format(value);
}
