import type { ActionResultLine } from '@local/components/game/ActionResult';

/** Canonical street-income split shown after Scout / Produce. */
export interface StreetIncomeBreakdown {
  grossIncome: number;
  workerPayoutShare: number;
  /** Player share after morale efficiency, before cartel donation. */
  playerShareBeforeCartel?: number;
  cartelContribution?: number;
  retainedCash: number;
}

export function buildStreetIncomeBreakdownLines(
  breakdown: StreetIncomeBreakdown,
): ActionResultLine[] {
  const cartel = breakdown.cartelContribution ?? 0;
  const lines: ActionResultLine[] = [
    {
      text: `$${breakdown.grossIncome.toLocaleString()} gross income`,
      tone: 'value',
    },
  ];

  if (breakdown.workerPayoutShare > 0) {
    lines.push({
      text: `−$${breakdown.workerPayoutShare.toLocaleString()} worker payout`,
      tone: 'neutral',
    });
  }

  const impliedShare = breakdown.grossIncome - breakdown.workerPayoutShare;
  const shareBeforeCartel = breakdown.playerShareBeforeCartel ?? impliedShare;
  const moraleLoss = impliedShare - shareBeforeCartel;
  if (moraleLoss > 0) {
    lines.push({
      text: `−$${moraleLoss.toLocaleString()} morale efficiency`,
      tone: 'neutral',
    });
  }

  if (cartel > 0) {
    lines.push({
      text: `−$${cartel.toLocaleString()} to cartel`,
      tone: 'neutral',
    });
  }

  lines.push({
    text: `+$${breakdown.retainedCash.toLocaleString()} you kept`,
    tone: 'positive',
  });

  return lines;
}
