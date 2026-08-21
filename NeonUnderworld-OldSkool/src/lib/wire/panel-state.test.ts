import { describe, it, expect } from 'vitest';
import { parseWireCommand } from './command-parser';
import { resolveWirePanelPhase } from './panel-state';
import { getCityShopItem } from '@core/config/game/shop-rules';

const baseStats = {
  cash: 1_000_000,
  netWorth: 5_000_000,
  rank: 37,
  turns: 1240,
  turnCap: 5000,
  workers: 842,
  thugs: 1921,
};

describe('resolveWirePanelPhase', () => {
  it('maps stat commands to stat phase', () => {
    const parsed = parseWireCommand("what's my cash");
    const phase = resolveWirePanelPhase("what's my cash", parsed, baseStats);
    expect(phase.phase).toBe('stat');
    if (phase.phase === 'stat') {
      expect(phase.label).toBe('CASH');
      expect(phase.value).toBe('$1,000,000');
    }
  });

  it('maps buy to confirm when affordable', () => {
    const cmd = 'buy 10 beer';
    const parsed = parseWireCommand(cmd);
    const phase = resolveWirePanelPhase(cmd, parsed, baseStats);
    expect(phase.phase).toBe('confirm');
    if (phase.phase === 'confirm') {
      expect(phase.preview.quantity).toBe(10);
      expect(phase.preview.unitPrice).toBe(getCityShopItem('beer')!.shopPrice);
    }
  });

  it('maps unaffordable buy to insufficient phase', () => {
    const cmd = 'buy 500 aks';
    const parsed = parseWireCommand(cmd);
    const phase = resolveWirePanelPhase(cmd, parsed, { ...baseStats, cash: 1000 });
    expect(phase.phase).toBe('insufficient');
    if (phase.phase === 'insufficient') {
      expect(phase.title).toBe('INSUFFICIENT CASH');
      expect(phase.maxAffordable).toBeGreaterThanOrEqual(0);
    }
  });

  it('maps hire thugs to hire_soon', () => {
    const cmd = 'hire 100 thugs';
    const parsed = parseWireCommand(cmd);
    const phase = resolveWirePanelPhase(cmd, parsed, baseStats);
    expect(phase.phase).toBe('hire_soon');
  });

  it('maps unknown commands to unknown phase', () => {
    const cmd = 'teleport now';
    const parsed = parseWireCommand(cmd);
    const phase = resolveWirePanelPhase(cmd, parsed, baseStats);
    expect(phase.phase).toBe('unknown');
  });

  it('maps voice-style buy max transcript to confirm phase', () => {
    const cmd = 'buy maximum aks';
    const parsed = parseWireCommand(cmd);
    const phase = resolveWirePanelPhase(cmd, parsed, baseStats);
    expect(phase.phase).toBe('confirm');
    if (phase.phase === 'confirm') {
      expect(phase.preview.itemKey).toBe('ak');
      expect(phase.preview.quantity).toBeGreaterThan(0);
    }
  });
});
