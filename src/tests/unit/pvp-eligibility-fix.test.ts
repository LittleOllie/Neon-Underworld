import { describe, it, expect } from 'vitest';
import {
  resolveOnlineSessionStart,
  shouldResetOfflineProtectionCycle,
  nextOfflineHitCount,
  shouldBlockOfflineProtectedDefender,
  isDamagingAttackResult,
} from '@/lib/game-engine/combat/offline-protection';
import {
  OFFLINE_ATTACK_LIMIT_STANDARD,
  OFFLINE_PROTECTION_RESET_ONLINE_MS,
  OFFLINE_THRESHOLD_MS,
} from '@/config/game/offline-protection';
import {
  resolveRequestedTargetIssue,
  resolveProfileAttackEligibility,
} from '@/lib/game-engine/combat/eligibility';
import { isWithinAttackRange } from '@/config/game/redlite-rules';
import { GAMEPLAY_CONTEXT_MESSAGES } from '@/lib/game-engine/gameplay-errors';

describe('offline protection online session reset', () => {
  const now = Date.UTC(2026, 7, 14, 12, 0, 0);

  it('starts a new online session after offline gap', () => {
    const lastSeen = new Date(now - OFFLINE_THRESHOLD_MS - 1000);
    const sessionStart = resolveOnlineSessionStart(lastSeen, new Date(now - 60_000), now);
    expect(sessionStart.getTime()).toBe(now);
  });

  it('preserves session start during continuous online activity', () => {
    const lastSeen = new Date(now - 5 * 60 * 1000);
    const previousStart = new Date(now - 20 * 60 * 1000);
    const sessionStart = resolveOnlineSessionStart(lastSeen, previousStart, now);
    expect(sessionStart.getTime()).toBe(previousStart.getTime());
  });

  it('does not reset protection before 30 continuous minutes online', () => {
    const sessionStart = new Date(now - 20 * 60 * 1000);
    const lastSeen = new Date(now - 60 * 1000);
    expect(
      shouldResetOfflineProtectionCycle(
        {
          offlineDamagingHits: 5,
          offlineProtectionActive: true,
          lastSeenAt: lastSeen,
          onlineSessionStartedAt: sessionStart,
        },
        now,
      ),
    ).toBe(false);
  });

  it('resets protection after 30 continuous minutes online', () => {
    const sessionStart = new Date(now - OFFLINE_PROTECTION_RESET_ONLINE_MS - 1000);
    const lastSeen = new Date(now - 60 * 1000);
    expect(
      shouldResetOfflineProtectionCycle(
        {
          offlineDamagingHits: 5,
          offlineProtectionActive: true,
          lastSeenAt: lastSeen,
          onlineSessionStartedAt: sessionStart,
        },
        now,
      ),
    ).toBe(true);
  });

  it('does not reset while player is offline even after long session start', () => {
    const sessionStart = new Date(now - 60 * 60 * 1000);
    const lastSeen = new Date(now - OFFLINE_THRESHOLD_MS - 1000);
    expect(
      shouldResetOfflineProtectionCycle(
        {
          offlineDamagingHits: 5,
          offlineProtectionActive: true,
          lastSeenAt: lastSeen,
          onlineSessionStartedAt: sessionStart,
        },
        now,
      ),
    ).toBe(false);
  });

  it('brief re-login does not reset — new session under 30 minutes', () => {
    const loginAt = now;
    const lastSeenBeforeLogin = new Date(now - OFFLINE_THRESHOLD_MS - 5000);
    const sessionStart = resolveOnlineSessionStart(lastSeenBeforeLogin, null, loginAt);
    expect(
      shouldResetOfflineProtectionCycle(
        {
          offlineDamagingHits: 5,
          offlineProtectionActive: true,
          lastSeenAt: new Date(loginAt),
          onlineSessionStartedAt: sessionStart,
        },
        loginAt + 5 * 60 * 1000,
      ),
    ).toBe(false);
  });

  it('activates protection after 5 damaging offline hits', () => {
    let hits = 0;
    for (let i = 0; i < OFFLINE_ATTACK_LIMIT_STANDARD; i++) {
      const next = nextOfflineHitCount(hits, true, true);
      hits = next.hits;
    }
    expect(hits).toBe(OFFLINE_ATTACK_LIMIT_STANDARD);
    expect(
      shouldBlockOfflineProtectedDefender({
        offlineDamagingHits: hits,
        offlineProtectionActive: true,
        lastSeenAt: new Date(now - OFFLINE_THRESHOLD_MS - 1000),
      }, now),
    ).toBe(true);
  });

  it('non-damaging attacks do not increment hits', () => {
    const next = nextOfflineHitCount(4, false, true);
    expect(next.hits).toBe(4);
    expect(next.protectionActive).toBe(false);
  });

  it('cartel-only damage counts as damaging', () => {
    expect(
      isDamagingAttackResult({
        defenderLosses: 0,
        cartelThugLosses: 2,
        cashStolen: 0,
        drugsStolen: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
        workersStolen: 0,
      }),
    ).toBe(true);
  });
});

describe('requested target resolution', () => {
  const base = {
    attackerId: 'a1',
    defenderId: 'd1',
    attackerDistrictId: 'city-a',
    defenderDistrictId: 'city-a',
    attackerNw: 1_000_000,
    defenderNw: 600_000,
    defenderLifeStatus: 'ACTIVE',
    defenderTravelling: false,
    defenderAlias: 'Rival',
    defenderAliasNormalized: 'rival',
  };

  it('flags below-range targets', () => {
    const issue = resolveRequestedTargetIssue({ ...base, defenderNw: 400_000 });
    expect(issue.issue).toBe('TARGET_OUT_OF_RANGE');
    expect(issue.heading).toBe(GAMEPLAY_CONTEXT_MESSAGES.belowAttackRangeHeading);
  });

  it('allows richer targets', () => {
    const issue = resolveRequestedTargetIssue({ ...base, defenderNw: 5_000_000 });
    expect(issue.issue).toBeNull();
  });

  it('flags wrong district', () => {
    const issue = resolveRequestedTargetIssue({ ...base, defenderDistrictId: 'city-b' });
    expect(issue.issue).toBe('TARGET_WRONG_DISTRICT');
  });

  it('profile eligibility mirrors resolution', () => {
    const below = resolveProfileAttackEligibility({
      viewerId: 'a1',
      viewerDistrictId: 'city-a',
      viewerNw: 1_000_000,
      targetPlayerId: 'd1',
      targetDistrictId: 'city-a',
      targetNw: 400_000,
      targetLifeStatus: 'ACTIVE',
      targetTravelling: false,
    });
    expect(below.status).toBe('below_range');
  });
});

describe('attack range floor for intel guard', () => {
  it('accepts exactly 50% NW', () => {
    expect(isWithinAttackRange(1_000_000, 500_000)).toBe(true);
  });

  it('rejects one below 50% NW', () => {
    expect(isWithinAttackRange(1_000_000, 499_999)).toBe(false);
  });
});
