import { describe, it, expect } from 'vitest';
import {
  MOBILE_NAV,
  DESKTOP_NAV,
  buildMoreMenuSections,
  navIsActive,
} from '@local/config/navigation';

describe('primary navigation', () => {
  it('mobile nav uses Home, Empire, Scout, Produce, More', () => {
    expect(MOBILE_NAV.map((item) => item.label)).toEqual([
      'Home',
      'Empire',
      'Scout',
      'Produce',
      'More',
    ]);
  });

  it('does not keep Rankings on mobile permanent nav', () => {
    expect(MOBILE_NAV.some((item) => item.label === 'Rankings')).toBe(false);
  });

  it('desktop nav still includes Shop and omits Rankings from primary bar', () => {
    expect(DESKTOP_NAV.map((item) => item.label)).toEqual([
      'Home',
      'Empire',
      'Scout',
      'Produce',
      'Shop',
      'More',
    ]);
  });

  it('marks produce route active', () => {
    expect(navIsActive('/produce', '/produce')).toBe(true);
  });
});

describe('MORE menu structure', () => {
  it('groups actions, underworld, and help in order', () => {
    const sections = buildMoreMenuSections();
    expect(sections.map((section) => section.label)).toEqual([
      'Actions',
      'Underworld',
      'Help',
    ]);
    expect(sections[0]?.items.map((item) => item.label)).toEqual([
      'Attack',
      'Shop',
      'Market',
      'Travel',
      'Add Turns',
    ]);
    expect(sections[1]?.items.map((item) => item.label)).toEqual([
      'Businesses',
      'Cartels',
      'Rankings',
      'Reports',
    ]);
    expect(sections[2]?.items.map((item) => item.label)).toEqual([
      'How to Play',
      'Guides',
      'Logout',
    ]);
  });

  it('shows unread report count on Reports row', () => {
    const sections = buildMoreMenuSections({ unreadReports: 3 });
    const reports = sections[1]?.items.find((item) => item.label === 'Reports');
    expect(reports?.badge).toBe(3);
  });

  it('omits badge when unread count is zero', () => {
    const sections = buildMoreMenuSections({ unreadReports: 0 });
    const reports = sections[1]?.items.find((item) => item.label === 'Reports');
    expect(reports?.badge).toBeUndefined();
  });
});
