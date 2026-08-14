import { describe, it, expect } from 'vitest';
import {
  isDamagingAttackResult,
  nextOfflineHitCount,
  shouldBlockOfflineProtectedDefender,
} from '@/lib/game-engine/combat/offline-protection';
import { OFFLINE_ATTACK_LIMIT_STANDARD } from '@/config/game/offline-protection';

describe('offline protection', () => {
  it('activates after standard hit limit while offline', () => {
    let hits = 0;
    for (let i = 0; i < OFFLINE_ATTACK_LIMIT_STANDARD; i++) {
      const next = nextOfflineHitCount(hits, true, true);
      hits = next.hits;
      if (i < OFFLINE_ATTACK_LIMIT_STANDARD - 1) {
        expect(next.protectionActive).toBe(false);
      }
    }
    expect(hits).toBe(OFFLINE_ATTACK_LIMIT_STANDARD);
    expect(
      shouldBlockOfflineProtectedDefender({
        offlineDamagingHits: hits,
        offlineProtectionActive: true,
        lastSeenAt: new Date(Date.now() - 60 * 60 * 1000),
      }),
    ).toBe(true);
  });

  it('does not count non-damaging attacks', () => {
    const next = nextOfflineHitCount(2, false, true);
    expect(next.hits).toBe(2);
    expect(next.protectionActive).toBe(false);
  });

  it('detects damaging combat results', () => {
    expect(
      isDamagingAttackResult({
        defenderLosses: 0,
        cartelThugLosses: 0,
        cashStolen: 5000,
        workersStolen: 0,
        drugsStolen: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      }),
    ).toBe(true);
  });
});
