import { NextResponse } from 'next/server';
import { prisma } from '@core/lib/db/prisma';
import { progressActiveSeasonNpcs } from '@core/server/services/npc-progression.service';

/** Daily NPC ladder progression — invoke via Vercel Cron or operator with CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await progressActiveSeasonNpcs(prisma);
  if (!result) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result });
}
