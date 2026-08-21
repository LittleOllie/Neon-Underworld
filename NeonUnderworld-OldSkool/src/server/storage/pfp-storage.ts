import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { extensionForMime, type AllowedPfpMime } from '@core/lib/game-engine/pfp-upload-validation';

export interface PfpStorageResult {
  url: string;
  storageKey: string;
}

export interface PfpStorage {
  save(playerId: string, buffer: Buffer, mime: AllowedPfpMime): Promise<PfpStorageResult>;
  deleteByUrl(url: string): Promise<void>;
}

const LOCAL_ROOT = path.join(process.cwd(), '.data', 'pfp-uploads');

function localPublicUrl(playerId: string, filename: string): string {
  return `/api/player-pfp/${playerId}/${filename}`;
}

export class LocalPfpStorage implements PfpStorage {
  async save(playerId: string, buffer: Buffer, mime: AllowedPfpMime): Promise<PfpStorageResult> {
    const ext = extensionForMime(mime);
    const filename = `${Date.now()}.${ext}`;
    const dir = path.join(LOCAL_ROOT, playerId);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await writeFile(filePath, buffer);
    return {
      url: localPublicUrl(playerId, filename),
      storageKey: `${playerId}/${filename}`,
    };
  }

  async deleteByUrl(url: string): Promise<void> {
    const prefix = '/api/player-pfp/';
    if (!url.startsWith(prefix)) return;
    const rel = url.slice(prefix.length);
    const filePath = path.join(LOCAL_ROOT, rel);
    try {
      await unlink(filePath);
    } catch {
      // ignore missing files
    }
  }
}

export async function readLocalPfpFile(relativePath: string): Promise<Buffer | null> {
  const safe = relativePath.replace(/\.\./g, '');
  const filePath = path.join(LOCAL_ROOT, safe);
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

async function saveToVercelBlob(
  playerId: string,
  buffer: Buffer,
  mime: AllowedPfpMime,
): Promise<PfpStorageResult> {
  const { put } = await import('@vercel/blob');
  const ext = extensionForMime(mime);
  const pathname = `player-pfp/${playerId}/${Date.now()}.${ext}`;
  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType: mime,
    addRandomSuffix: false,
  });
  return { url: blob.url, storageKey: blob.pathname };
}

class VercelBlobPfpStorage implements PfpStorage {
  async save(playerId: string, buffer: Buffer, mime: AllowedPfpMime): Promise<PfpStorageResult> {
    return saveToVercelBlob(playerId, buffer, mime);
  }

  async deleteByUrl(_url: string): Promise<void> {
    // Optional cleanup — blob delete requires separate API; skip for v1
  }
}

/** Production: Vercel Blob when BLOB_READ_WRITE_TOKEN is set. Dev: local .data store. */
export function getPfpStorage(): PfpStorage {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return new VercelBlobPfpStorage();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'PFP uploads require BLOB_READ_WRITE_TOKEN in production. See docs/DEPLOYMENT.md.',
    );
  }
  return new LocalPfpStorage();
}

export function pfpStorageMode(): 'vercel-blob' | 'local' {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  return 'local';
}
