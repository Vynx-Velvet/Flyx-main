/**
 * Debounce utility — single implementation for the entire platform.
 *
 * In Flyx 2.0, `useDebounce` was duplicated in:
 * - `app/hooks/useDebounce.ts`
 * - `app/lib/hooks/useDebounce.ts`
 *
 * This is the single canonical implementation.
 *
 * @module debounce
 */

/**
 * Create a debounced version of a function.
 *
 * The debounced function delays invoking `fn` until `delayMs`
 * milliseconds have elapsed since the last invocation.
 *
 * @param fn - The function to debounce.
 * @param delayMs - Delay in milliseconds.
 * @returns A debounced version of `fn` with a `.cancel()` method.
 *
 * @example
 * ```ts
 * const search = debounce((query: string) => api.search(query), 300);
 * input.addEventListener("input", (e) => search(e.target.value));
 * ```
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number,
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

/**
 * Create a throttled version of a function.
 *
 * The throttled function invokes `fn` at most once per `limitMs` milliseconds.
 *
 * @param fn - The function to throttle.
 * @param limitMs - Minimum time between invocations.
 * @returns A throttled version of `fn`.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limitMs: number,
): T {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const elapsed = now - lastCall;

    if (elapsed >= limitMs) {
      lastCall = now;
      fn(...args);
    } else if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, limitMs - elapsed);
    }
  };

  return throttled as T;
}
