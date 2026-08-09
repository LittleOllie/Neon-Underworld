import { SCOUTING_CONFIG } from '@/config/game/balance';
import type { PlayerState } from '@/server/queries/player.queries';
import { readinessStatus } from '@/lib/game/season-display';

export interface Recommendation {
  title: string;
  description: string;
  action: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CommandPresentation {
  status: string;
  headline: string;
  subline: string;
  cta: string;
  href: string;
  empireHealth: 'Operational' | 'Stable' | 'At risk' | 'Critical';
}

export function getRecommendation(state: PlayerState): Recommendation {
  if (state.turns >= 100) {
    return {
      title: 'Deploy to the district',
      description: 'Turns are available. Scouting recruits Prostitutes and Thugs while generating Cash.',
      action: 'Begin Operation',
      href: '/operations/scout',
      priority: 'high',
    };
  }

  if (state.prostituteHappiness.score < SCOUTING_CONFIG.prostituteHappinessWarningThreshold) {
    return {
      title: 'Morale requires attention',
      description: 'Prostitute happiness is below safe levels. Review supplies and payout in Empire.',
      action: 'Review Empire',
      href: '/empire',
      priority: 'high',
    };
  }

  if (state.isAtCap) {
    return {
      title: 'Turn storage at capacity',
      description: 'Your turn reserve is full. Deploy before regeneration is lost.',
      action: 'Begin Operation',
      href: '/operations/scout',
      priority: 'high',
    };
  }

  if (state.turnCap - state.turns < 500) {
    return {
      title: 'Approaching turn cap',
      description: 'Turn storage is nearly full. Consider deploying a scout run.',
      action: 'Begin Operation',
      href: '/operations/scout',
      priority: 'medium',
    };
  }

  if (state.rankMovement > 0) {
    return {
      title: 'Rank improved',
      description: `You moved up ${state.rankMovement} position${state.rankMovement > 1 ? 's' : ''} this season.`,
      action: 'View rankings',
      href: '/rankings',
      priority: 'medium',
    };
  }

  return {
    title: 'Empire stable',
    description: 'No urgent actions. Scout when ready to expand your operation.',
    action: 'Begin Operation',
    href: '/operations/scout',
    priority: 'low',
  };
}

export function getCommandPresentation(state: PlayerState): CommandPresentation {
  const rec = getRecommendation(state);
  const district = state.district.name;
  const prostituteStatus = readinessStatus(state.prostituteHappiness.score);
  const thugStatus = readinessStatus(state.thugHappiness.score);
  const empireHealth =
    prostituteStatus === 'Critical' || thugStatus === 'Critical'
      ? 'Critical'
      : prostituteStatus === 'At risk' || thugStatus === 'At risk'
        ? 'At risk'
        : prostituteStatus === 'Operational' && thugStatus === 'Operational'
          ? 'Operational'
          : 'Stable';

  if (rec.href === '/empire') {
    return {
      status: 'ATTENTION',
      headline: 'Empire readiness needs review.',
      subline: rec.description,
      cta: rec.action,
      href: rec.href,
      empireHealth,
    };
  }

  if (state.isAtCap) {
    return {
      status: 'CAPACITY',
      headline: 'Turn storage is at maximum.',
      subline: 'Deploy operatives before regeneration is wasted.',
      cta: 'Begin Operation',
      href: '/operations/scout',
      empireHealth,
    };
  }

  if (rec.href === '/rankings') {
    return {
      status: 'ASCENDANT',
      headline: `Rank improved — now #${state.rank}.`,
      subline: rec.description,
      cta: rec.action,
      href: rec.href,
      empireHealth,
    };
  }

  if (state.turns >= 100) {
    return {
      status: 'READY',
      headline: `${district} is active tonight.`,
      subline: 'Conditions look favourable for expansion.',
      cta: 'Begin Operation',
      href: '/operations/scout',
      empireHealth,
    };
  }

  return {
    status: 'READY',
    headline: `${district} is quiet.`,
    subline: rec.description,
    cta: rec.action,
    href: rec.href,
    empireHealth,
  };
}
