import type { ThreadTokenUsage } from '../app-server/protocol.js';

const numberFormat = new Intl.NumberFormat('en-US');

export function printSessionSummary(
  usage: ThreadTokenUsage | undefined,
  threadId: string | undefined,
  codexHome: string,
): void {
  const totals = usage?.total;
  const cachedTokens = totals?.cachedInputTokens ?? 0;
  const inputTokens = totals?.inputTokens ?? 0;
  const outputTokens = totals?.outputTokens ?? 0;
  const totalTokens = totals?.totalTokens ?? 0;
  const cached = cachedTokens ? ` (+ ${formatNumber(cachedTokens)} cached)` : '';

  process.stdout.write(
    `\nToken usage: total=${formatNumber(totalTokens)} input=${formatNumber(inputTokens)}${cached} output=${formatNumber(outputTokens)}\n`,
  );

  if (threadId) {
    process.stdout.write(
      `To continue this session, run CODEX_HOME=${shellQuote(codexHome)} codex -c 'forced_login_method="api"' resume ${threadId}\n`,
    );
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function formatNumber(value: number): string {
  return numberFormat.format(value);
}
