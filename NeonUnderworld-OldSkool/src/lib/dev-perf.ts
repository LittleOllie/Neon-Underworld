/** Development or PERF_LOG=1 async timing. */
export async function devPerf<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const enabled = process.env.NODE_ENV === 'development' || process.env.PERF_LOG === '1';
  if (!enabled) {
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
