export interface CityFeedItem {
  id: string;
  prefix: '▲' | '●';
  text: string;
}

export function buildCityFeed(items: {
  topPlayer?: { alias: string; rank?: number } | null;
  largestMovement?: { alias: string; movement: number } | null;
  topDistrict?: { name: string; count: number } | null;
  latestEvent?: { type: string } | null;
}): CityFeedItem[] {
  const feed: CityFeedItem[] = [];

  if (items.largestMovement?.alias && items.largestMovement.movement > 0) {
    feed.push({
      id: 'movement',
      prefix: '▲',
      text: `${items.largestMovement.alias} gained $${items.largestMovement.movement.toLocaleString()} net worth`,
    });
  }

  if (items.topPlayer?.alias) {
    feed.push({
      id: 'top',
      prefix: '▲',
      text: `${items.topPlayer.alias} holds #1`,
    });
  }

  if (items.topDistrict?.name) {
    feed.push({
      id: 'district',
      prefix: '●',
      text: `Heavy activity in ${items.topDistrict.name}`,
    });
  }

  if (items.latestEvent) {
    feed.push({
      id: 'event',
      prefix: '●',
      text: items.latestEvent.type.replace(/_/g, ' ').toLowerCase(),
    });
  }

  return feed.slice(0, 4);
}
