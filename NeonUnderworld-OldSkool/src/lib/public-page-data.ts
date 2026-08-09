import { getDistricts, getActiveSeason, getRankings } from '@core/server/queries/player.queries';

export type PublicPageData =
  | {
      ok: true;
      districts: Awaited<ReturnType<typeof getDistricts>>;
      season: Awaited<ReturnType<typeof getActiveSeason>>;
      leaders: Array<{ rank: number; alias: string; netWorth: number }>;
      seasonLabel: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function loadPublicPageData(options?: {
  includeDistricts?: boolean;
}): Promise<PublicPageData> {
  try {
    const includeDistricts = options?.includeDistricts ?? false;
    const [districts, season] = await Promise.all([
      includeDistricts ? getDistricts() : Promise.resolve([]),
      getActiveSeason(),
    ]);

    const leaders = season ? (await getRankings(season.id, 1, 5)).items : [];

    if (includeDistricts && districts.length === 0) {
      return {
        ok: false,
        message:
          'Registration is temporarily unavailable — no districts are configured. The database may need to be seeded.',
      };
    }

    return {
      ok: true,
      districts,
      season,
      leaders: leaders.map((l) => ({ rank: l.rank, alias: l.alias, netWorth: l.netWorth })),
      seasonLabel: season ? `Season ${season.number}` : 'No active season',
    };
  } catch (error) {
    console.error('Public page data load failed:', error);
    return {
      ok: false,
      message:
        'Unable to reach the game database. Check that DATABASE_URL is configured and migrations have been run on Vercel.',
    };
  }
}
