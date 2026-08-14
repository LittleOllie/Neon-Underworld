const STORAGE_KEY = 'nu-reports-read-ids';

export const REPORT_READ_EVENT = 'nu-report-read';
export const REPORTS_MARK_ALL_READ_EVENT = 'nu-reports-mark-all-read';

function readIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function writeIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

export function getLocallyReadReportIds(): Set<string> {
  return readIds();
}

export function markReportReadLocally(reportId: string) {
  const ids = readIds();
  ids.add(reportId);
  writeIds(ids);
}

export function markAllReportsReadLocally(reportIds: string[]) {
  const ids = readIds();
  for (const id of reportIds) ids.add(id);
  writeIds(ids);
}

export function notifyReportRead() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(REPORT_READ_EVENT));
  }
}

export function notifyReportsMarkAllRead() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(REPORTS_MARK_ALL_READ_EVENT));
  }
}
