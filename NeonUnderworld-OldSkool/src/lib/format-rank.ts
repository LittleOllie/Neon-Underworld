/** Player-facing rank — never show #0; use em dash when unavailable. */
export function formatRank(rank: number | null | undefined): string {
  if (rank == null || rank <= 0) return '—';
  return `#${rank}`;
}
