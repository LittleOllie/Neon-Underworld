import { NextResponse } from 'next/server';
import { auth } from '@local/lib/auth/config';
import { validatePfpUpload } from '@core/lib/game-engine/pfp-upload-validation';
import { getPfpStorage } from '@local/server/storage/pfp-storage';

export async function POST(request: Request) {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validatePfpUpload(buffer, file.type || null);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const storage = getPfpStorage();
    const saved = await storage.save(playerId, buffer, validation.mime);
    return NextResponse.json({ url: saved.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
