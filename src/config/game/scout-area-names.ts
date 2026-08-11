import { DISTRICTS } from '@/config/game/balance';
import {
  REDLITE_SCOUT_AREAS,
  type RedliteScoutAreaSlug,
} from '@/config/game/redlite-rules';

export type DistrictSlug = (typeof DISTRICTS)[number]['slug'];

/** Display names for the five scout areas — unique per district, same mechanics everywhere. */
export const DISTRICT_SCOUT_AREA_NAMES: Record<
  DistrictSlug,
  Record<RedliteScoutAreaSlug, string>
> = {
  'neon-strip': {
    streets: 'The Neon Strip',
    clubs: 'Velvet Room',
    docks: 'Canal Promenade',
    alleys: 'Backstage Alley',
    markets: 'Blacklight Bazaar',
  },
  docklands: {
    streets: 'Freight Row',
    clubs: 'Harbor Lights Club',
    docks: 'Container Yard',
    alleys: 'Crane Alley',
    markets: "Smuggler's Exchange",
  },
  'old-quarter': {
    streets: 'Cobblestone Lane',
    clubs: "The Gentleman's Club",
    docks: 'Old Canal Wharf',
    alleys: 'Guild Passage',
    markets: "Merchant's Crypt",
  },
};

export function getDistrictScoutAreaName(
  districtSlug: string,
  areaSlug: RedliteScoutAreaSlug,
): string {
  const districtNames = DISTRICT_SCOUT_AREA_NAMES[districtSlug as DistrictSlug];
  if (districtNames?.[areaSlug]) return districtNames[areaSlug];
  return REDLITE_SCOUT_AREAS.find((a) => a.slug === areaSlug)?.name ?? areaSlug;
}
