import { REDLITE_TRAVEL } from '@/config/game/redlite-rules';
import { DISTRICTS } from '@/config/game/balance';

export function travelCrewPopulation(thugs: number, prostitutes: number): number {
  return Math.max(0, thugs) + Math.max(0, prostitutes);
}

export function ridesRequiredForTravel(crewPopulation: number): number {
  if (crewPopulation <= 0) return REDLITE_TRAVEL.minRidesRequired;
  return Math.max(
    REDLITE_TRAVEL.minRidesRequired,
    Math.ceil(crewPopulation / REDLITE_TRAVEL.crewPerRide),
  );
}

export function validateTravelDestination(
  currentDistrictSlug: string,
  destinationDistrictSlug: string,
): boolean {
  return currentDistrictSlug !== destinationDistrictSlug;
}

export function travelDestinationsForSlug(currentSlug: string) {
  return DISTRICTS.filter((d) => d.slug !== currentSlug).map((d) => ({
    slug: d.slug,
    name: d.name,
    description: d.description,
  }));
}
