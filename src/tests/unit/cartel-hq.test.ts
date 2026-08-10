import { describe, it, expect } from 'vitest';
import { formatMemberPresence } from '@/lib/game-engine/cartel-presence';
import {
  CARTEL_ARMOURY_WEAPON_TYPES,
  CARTEL_AK_SUPPORTED,
} from '@/server/services/cartel.service';

describe('cartel member presence', () => {
  it('marks recent login as online', () => {
    const now = Date.parse('2026-08-10T12:00:00Z');
    const presence = formatMemberPresence(new Date('2026-08-10T11:50:00Z'), now);
    expect(presence.online).toBe(true);
    expect(presence.label).toBe('Online');
  });

  it('formats last seen for inactive members', () => {
    const now = Date.parse('2026-08-10T12:00:00Z');
    const presence = formatMemberPresence(new Date('2026-08-10T11:00:00Z'), now);
    expect(presence.online).toBe(false);
    expect(presence.label).toBe('1h ago');
  });
});

describe('cartel armoury rules', () => {
  it('supports Uzi and Glock only when cartel armoury is built', () => {
    expect(CARTEL_ARMOURY_WEAPON_TYPES).toEqual(['glock', 'uzi']);
  });

  it('does not support cartel AK-47 per Redlite guide', () => {
    expect(CARTEL_AK_SUPPORTED).toBe(false);
  });
});
