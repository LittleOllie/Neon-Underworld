import { describe, it, expect } from 'vitest';
import { buildStreetIncomeBreakdownLines } from '@local/lib/income-breakdown';

describe('street income breakdown lines', () => {
  it('shows gross, worker payout, cartel, and retained cash', () => {
    const lines = buildStreetIncomeBreakdownLines({
      grossIncome: 500_000,
      workerPayoutShare: 250_000,
      cartelContribution: 50_000,
      retainedCash: 200_000,
    });
    expect(lines.map((l) => l.text)).toEqual([
      '$500,000 gross income',
      '−$250,000 worker payout',
      '−$50,000 to cartel',
      '+$200,000 you kept',
    ]);
  });

  it('omits zero worker and cartel lines', () => {
    const lines = buildStreetIncomeBreakdownLines({
      grossIncome: 10_000,
      workerPayoutShare: 0,
      cartelContribution: 0,
      retainedCash: 10_000,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]?.text).toBe('$10,000 gross income');
    expect(lines[1]?.text).toBe('+$10,000 you kept');
  });

  it('includes morale efficiency when share is reduced', () => {
    const lines = buildStreetIncomeBreakdownLines({
      grossIncome: 100_000,
      workerPayoutShare: 50_000,
      playerShareBeforeCartel: 45_000,
      cartelContribution: 9_000,
      retainedCash: 36_000,
    });
    expect(lines.map((l) => l.text)).toContain('−$5,000 morale efficiency');
  });
});
