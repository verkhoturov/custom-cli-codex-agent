import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function ensureCodexHome(codexHome: string): void {
  mkdirSync(codexHome, { mode: 0o700, recursive: true });

  const configPath = join(codexHome, 'config.toml');

  if (!existsSync(configPath)) {
    return;
  }

  const config = readFileSync(configPath, 'utf8');
  const firstTableIndex = config.search(/^[ \t]*\[\[?/m);
  const topLevelEnd = firstTableIndex === -1 ? config.length : firstTableIndex;
  const topLevel = config.slice(0, topLevelEnd);
  const forcedLoginSetting = /^[ \t]*forced_login_method[ \t]*=.*(?:\r?\n|$)/m;
  const updated = topLevel.replace(forcedLoginSetting, '') + config.slice(topLevelEnd);

  if (updated !== config) {
    writeFileSync(configPath, updated);
  }
}
