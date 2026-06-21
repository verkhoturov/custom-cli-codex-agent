import { createInterface, type Interface } from 'node:readline/promises';

export interface Terminal {
  readonly isTTY: boolean;
  clear(): void;
  close(): void;
  onInterrupt(handler: () => void): () => void;
  question(prompt: string): Promise<string>;
  write(value: string): void;
  writeError(value: string): void;
}

export class NodeTerminal implements Terminal {
  private readonly readline: Interface;

  constructor() {
    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    });
  }

  get isTTY(): boolean {
    return Boolean(process.stdout.isTTY);
  }

  clear(): void {
    console.clear();
  }

  close(): void {
    this.readline.close();
  }

  onInterrupt(handler: () => void): () => void {
    this.readline.on('SIGINT', handler);
    return () => this.readline.off('SIGINT', handler);
  }

  question(prompt: string): Promise<string> {
    return this.readline.question(prompt);
  }

  write(value: string): void {
    process.stdout.write(value);
  }

  writeError(value: string): void {
    process.stderr.write(value);
  }
}
