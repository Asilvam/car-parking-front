/** Only the newest request may publish results, including after cancellation. */
export function createLatestRequest<T>(
  fetchData: (signal: AbortSignal) => Promise<T>,
  onSuccess: (data: T) => void,
  onError: (error: unknown) => void,
) {
  let current: AbortController | undefined;
  return {
    async run() {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      try {
        const result = await fetchData(controller.signal);
        if (!controller.signal.aborted) onSuccess(result);
      } catch (error) {
        if (!controller.signal.aborted) onError(error);
      }
    },
    cancel() {
      current?.abort();
    },
  };
}
