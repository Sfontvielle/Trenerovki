export function createQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return function enqueue<Result>(task: () => Promise<Result>): Promise<Result> {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}
