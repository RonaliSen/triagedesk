/** Polls `predicate` until it's true, instead of guessing how many ticks an async chain needs. */
export async function waitUntil(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil: condition was not met within the timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
