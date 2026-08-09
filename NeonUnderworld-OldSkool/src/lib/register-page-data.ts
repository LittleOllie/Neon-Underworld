import { getDistricts, getActiveSeason } from '@core/server/queries/player.queries';

export type RegisterPageData =
  | {
      ok: true;
      districts: Array<{ slug: string; name: string; description: string }>;
    }
  | {
      ok: false;
      message: string;
    };

export async function loadRegisterPageData(): Promise<RegisterPageData> {
  try {
    const [districts, season] = await Promise.all([getDistricts(), getActiveSeason()]);

    if (!season) {
      return {
        ok: false,
        message: 'No active season. Run database migrations and seed before registering.',
      };
    }

    if (districts.length === 0) {
      return {
        ok: false,
        message:
          'Registration is temporarily unavailable — no districts are configured. The database may need to be seeded.',
      };
    }

    return {
      ok: true,
      districts: districts.map((d) => ({
        slug: d.slug,
        name: d.name,
        description: d.description,
      })),
    };
  } catch (error) {
    console.error('Register page data load failed:', error);
    return {
      ok: false,
      message:
        'Unable to reach the game database. On Vercel, set DATABASE_URL and AUTH_SECRET, then run migrations and seed.',
    };
  }
}
