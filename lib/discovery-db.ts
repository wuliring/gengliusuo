import {initializeArchive} from "./archive-db";
import {recordSchema, type StoredMeme} from "./records";

type DiscoveryRow = {id: string; body: string; revision: number; updated_at: string; views: number};

export async function getRandomPublishedRecord(excludeId?: string): Promise<StoredMeme | null> {
  const db = await initializeArchive();
  const excluded = excludeId && excludeId.length >= 2 && excludeId.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(excludeId) ? excludeId : null;
  const columns = "id,body,revision,updated_at,views";
  let row = excluded
    ? await db.prepare(`SELECT ${columns} FROM records WHERE status='published' AND id<>?1 ORDER BY RANDOM() LIMIT 1`).bind(excluded).first<DiscoveryRow>()
    : await db.prepare(`SELECT ${columns} FROM records WHERE status='published' ORDER BY RANDOM() LIMIT 1`).first<DiscoveryRow>();
  if (!row && excluded) row = await db.prepare(`SELECT ${columns} FROM records WHERE status='published' ORDER BY RANDOM() LIMIT 1`).first<DiscoveryRow>();
  if (!row) return null;
  return {...recordSchema.parse(JSON.parse(row.body)), revision: row.revision, updatedAt: row.updated_at, views: row.views};
}
