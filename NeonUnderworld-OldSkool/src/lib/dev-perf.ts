/** Development-only async timing — no-op in production. */
export async function devPerf<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV !== 'development') {
    return fn();
  }
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - start);
    console.info(`[PERF] ${label}: ${ms}ms`);
  }
}
