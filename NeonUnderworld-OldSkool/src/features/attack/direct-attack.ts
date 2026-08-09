const DIRECT_TARGET_PREFIX = 'direct:';

export function directAttackReportId(aliasNormalized: string): string {
  return `${DIRECT_TARGET_PREFIX}${aliasNormalized}`;
}

export function parseDirectAttackReportId(reportId: string): string | null {
  if (!reportId.startsWith(DIRECT_TARGET_PREFIX)) return null;
  return reportId.slice(DIRECT_TARGET_PREFIX.length);
}
