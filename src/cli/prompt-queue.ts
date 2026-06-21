export class PromptQueue {
  private tail: Promise<void> = Promise.resolve();

  run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
