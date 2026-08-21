import { describe, expect, it } from 'vitest';
import {
  buildCombatOutcomeLabel,
  buildCombatResultPresentation,
  formatCombatClosingLine,
  formatCombatContextLine,
  formatCombatLootLines,
  formatCombatOutcomeHeading,
  resolveCombatOutcomeLabel,
} from '@/lib/game-engine/combat/attack-result-presentation';

const emptyDrugs = { hash: 0, shrooms: 0, coke: 0, heroin: 0 };

describe('formatCombatOutcomeHeading', () => {
  it('maps canonical outcomes to player headings', () => {
    expect(formatCombatOutcomeHeading('SUCCESS')).toBe('VICTORY');
    expect(formatCombatOutcomeHeading('PARTIAL')).toBe('PARTIAL SUCCESS');
    expect(formatCombatOutcomeHeading('REPULSED')).toBe('REPULSED');
  });
});

describe('resolveCombatOutcomeLabel', () => {
  it('re-derives label when replay stored raw enum', () => {
    expect(
      resolveCombatOutcomeLabel({
        attackType: 'RAID_DRUG_LABS',
        outcome: 'SUCCESS',
        outcomeLabel: 'SUCCESS',
      }),
    ).toBe('Raid successful.');
  });

  it('preserves human-readable stored label', () => {
    expect(
      resolveCombatOutcomeLabel({
        attackType: 'RAID_DRUG_LABS',
        outcome: 'SUCCESS',
        outcomeLabel: 'Raid successful.',
      }),
    ).toBe('Raid successful.');
  });
});

describe('formatCombatLootLines', () => {
  it('maps technology stock to NU labels', () => {
    const lines = formatCombatLootLines({
      attackType: 'RAID_DRUG_LABS',
      outcome: 'SUCCESS',
      targetAlias: 'DockWolf02',
      cashStolen: 0,
      workersStolen: 0,
      drugsStolen: { hash: 320, shrooms: 0, coke: 45, heroin: 0 },
      attackerLosses: 2,
      defenderLosses: 6,
      turnsSpent: 10,
    });
    expect(lines.map((l) => l.text)).toEqual(['320 Components', '45 Modules']);
  });

  it('omits loot lines for Strike', () => {
    expect(
      formatCombatLootLines({
        attackType: 'DRIVE_BY',
        outcome: 'SUCCESS',
        targetAlias: 'Target',
        cashStolen: 0,
        workersStolen: 0,
        drugsStolen: emptyDrugs,
        attackerLosses: 1,
        defenderLosses: 3,
        turnsSpent: 5,
      }),
    ).toEqual([]);
  });
});

describe('buildCombatResultPresentation', () => {
  it('renders raid victory with technology loot and losses', () => {
    const view = buildCombatResultPresentation({
      attackType: 'RAID_DRUG_LABS',
      outcome: 'SUCCESS',
      outcomeLabel: 'Raid successful.',
      targetAlias: 'DockWolf02',
      cashStolen: 0,
      workersStolen: 0,
      drugsStolen: { hash: 320, shrooms: 0, coke: 45, heroin: 0 },
      attackerLosses: 2,
      defenderLosses: 6,
      turnsSpent: 10,
      role: 'attacker',
    });

    expect(view.heading).toBe('VICTORY');
    expect(view.contextLine).toBe('Raid on DockWolf02');
    expect(view.sections.find((s) => s.label === 'YOU TOOK')?.lines.map((l) => l.text)).toEqual([
      '320 Components',
      '45 Modules',
    ]);
    expect(view.sections.find((s) => s.label === 'YOU LOST')?.lines[0]?.text).toBe('2 Enforcers');
    expect(view.sections.find((s) => s.label === 'THEY LOST')?.lines[0]?.text).toBe('6 Enforcers');
    expect(view.closingLine).toContain('320 Components');
  });

  it('shows NO RESOURCES SECURED on partial raid', () => {
    const view = buildCombatResultPresentation({
      attackType: 'RAID_DRUG_LABS',
      outcome: 'PARTIAL',
      outcomeLabel: 'Raid partial — defenders damaged, no assets taken.',
      targetAlias: 'DockWolf02',
      cashStolen: 0,
      workersStolen: 0,
      drugsStolen: emptyDrugs,
      attackerLosses: 2,
      defenderLosses: 4,
      turnsSpent: 10,
    });
    expect(view.heading).toBe('PARTIAL SUCCESS');
    expect(view.sections.find((s) => s.label === 'YOU TOOK')?.lines[0]?.text).toBe(
      'NO RESOURCES SECURED',
    );
  });

  it('swaps loss perspective for defence reports', () => {
    const view = buildCombatResultPresentation({
      attackType: 'RAID_DRUG_LABS',
      outcome: 'REPULSED',
      targetAlias: 'DockWolf02',
      attackerAlias: 'Herman',
      cashStolen: 0,
      workersStolen: 0,
      drugsStolen: emptyDrugs,
      attackerLosses: 2,
      defenderLosses: 6,
      turnsSpent: 10,
      role: 'defender',
    });
    expect(formatCombatContextLine('RAID_DRUG_LABS', 'DockWolf02', {
      role: 'defender',
      attackerAlias: 'Herman',
    })).toBe('Raid from Herman');
    expect(view.sections.find((s) => s.label === 'YOU LOST')?.lines[0]?.text).toBe('6 Enforcers');
    expect(view.sections.find((s) => s.label === 'THEY LOST')?.lines[0]?.text).toBe('2 Enforcers');
  });

  it('omits YOU TOOK for strike and uses strike closing copy', () => {
    const view = buildCombatResultPresentation({
      attackType: 'DRIVE_BY',
      outcome: 'SUCCESS',
      targetAlias: 'Operator',
      cashStolen: 0,
      workersStolen: 0,
      drugsStolen: emptyDrugs,
      attackerLosses: 1,
      defenderLosses: 4,
      turnsSpent: 5,
    });
    expect(view.sections.some((s) => s.label === 'YOU TOOK')).toBe(false);
    expect(view.closingLine).toMatch(/Strike complete/i);
  });

  it('renders breach cash and extraction specialists', () => {
    const breach = buildCombatResultPresentation({
      attackType: 'HOME_INVASION',
      outcome: 'SUCCESS',
      targetAlias: 'Operator',
      cashStolen: 18_400,
      workersStolen: 0,
      drugsStolen: emptyDrugs,
      attackerLosses: 1,
      defenderLosses: 3,
      turnsSpent: 8,
    });
    expect(breach.sections.find((s) => s.label === 'YOU TOOK')?.lines[0]?.text).toBe(
      '$18,400 Cash',
    );

    const extraction = buildCombatResultPresentation({
      attackType: 'POACH_WORKERS',
      outcome: 'SUCCESS',
      targetAlias: 'Operator',
      cashStolen: 0,
      workersStolen: 12,
      drugsStolen: emptyDrugs,
      attackerLosses: 2,
      defenderLosses: 0,
      turnsSpent: 12,
    });
    expect(extraction.sections.find((s) => s.label === 'YOU TOOK')?.lines[0]?.text).toBe(
      '12 Specialists',
    );
  });
});

describe('buildCombatOutcomeLabel', () => {
  it('matches strike partial and repulsed labels', () => {
    expect(
      buildCombatOutcomeLabel({ attackType: 'DRIVE_BY', outcome: 'PARTIAL' }),
    ).toMatch(/no losses/i);
    expect(
      buildCombatOutcomeLabel({ attackType: 'HOME_INVASION', outcome: 'REPULSED' }),
    ).toBe('Breach repulsed.');
  });
});

describe('formatCombatClosingLine', () => {
  it('describes repulsed raid with attacker losses', () => {
    expect(
      formatCombatClosingLine({
        attackType: 'RAID_DRUG_LABS',
        outcome: 'REPULSED',
        targetAlias: 'DockWolf02',
        cashStolen: 0,
        workersStolen: 0,
        drugsStolen: emptyDrugs,
        attackerLosses: 2,
        defenderLosses: 0,
        turnsSpent: 10,
      }),
    ).toBe('Raid repulsed. You lost 2 Enforcers and secured nothing.');
  });
});
