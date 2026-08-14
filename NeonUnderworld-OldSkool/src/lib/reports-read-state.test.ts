import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLocallyReadReportIds,
  markAllReportsReadLocally,
  markReportReadLocally,
} from './reports-read-state';

function mockSessionStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    clear: () => store.clear(),
  });
}

describe('reports-read-state', () => {
  beforeEach(() => {
    mockSessionStorage();
    sessionStorage.clear();
  });

  it('tracks locally read report ids in sessionStorage', () => {
    markReportReadLocally('report-a');
    expect(getLocallyReadReportIds().has('report-a')).toBe(true);
    expect(getLocallyReadReportIds().has('report-b')).toBe(false);
  });

  it('merges mark-all ids without duplicates', () => {
    markReportReadLocally('report-a');
    markAllReportsReadLocally(['report-a', 'report-b']);
    const ids = getLocallyReadReportIds();
    expect(ids.has('report-a')).toBe(true);
    expect(ids.has('report-b')).toBe(true);
    expect(ids.size).toBe(2);
  });
});
