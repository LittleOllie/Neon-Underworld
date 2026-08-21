import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { seasonRankingsCacheTag } from '@local/server/services/gameplay-cache';

/** Dev-only — bust Rankings unstable_cache after DB repairs (e.g. NPC season reattach). */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  let seasonId: string | undefined;
  try {
    const body = (await request.json()) as { seasonId?: string };
    seasonId = body.seasonId;
  } catch {
    seasonId = undefined;
  }

  if (!seasonId?.trim()) {
    return NextResponse.json({ error: 'seasonId required' }, { status: 400 });
  }

  revalidateTag(seasonRankingsCacheTag(seasonId));
  return NextResponse.json({ ok: true, seasonId, tag: seasonRankingsCacheTag(seasonId) });
}
