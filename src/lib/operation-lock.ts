/** Synchronous guard: React state alone cannot prevent two sends in one turn. */
export function createOperationLock() {
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    tryAcquire() {
      if (pending) return false;
      pending = true;
      return true;
    },
    release() {
      pending = false;
    },
  };
}
