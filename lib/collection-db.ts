import { getPublishedByIds } from "./archive-db";
import { collections, getCollection, type ArchiveCollection } from "./collections";
import { categories, type StoredMeme } from "./records";

export type CollectionSummary = {
  collection: ArchiveCollection;
  records: StoredMeme[];
  count: number;
  years: number[];
  yearSpan: string;
  unknownYearCount: number;
  categories: Array<(typeof categories)[number]>;
  representatives: StoredMeme[];
};

export function sortCollectionRecords(records: StoredMeme[]): StoredMeme[] {
  return [...records].sort((left, right) => {
    if (left.year === null && right.year !== null) return 1;
    if (left.year !== null && right.year === null) return -1;
    if (left.year !== null && right.year !== null && left.year !== right.year) {
      return right.year - left.year;
    }
    return left.name.localeCompare(right.name, "zh-CN") || left.id.localeCompare(right.id);
  });
}

function summarize(collection: ArchiveCollection, input: StoredMeme[]): CollectionSummary {
  const unique = new Map(input.map((record) => [record.id, record]));
  const records = sortCollectionRecords([...unique.values()]);
  const years = [...new Set(records.flatMap((record) => record.year === null ? [] : [record.year]))]
    .sort((left, right) => right - left);
  const yearSpan = !years.length
    ? "年份待考"
    : years.length === 1
      ? String(years[0])
      : String(years[years.length - 1]) + "—" + String(years[0]);
  return {
    collection,
    records,
    count: records.length,
    years,
    yearSpan,
    unknownYearCount: records.filter((record) => record.year === null).length,
    categories: categories.filter((category) => records.some((record) => record.category === category)),
    representatives: records.slice(0, 3),
  };
}

export async function getCollectionSummaries(): Promise<CollectionSummary[]> {
  const ids = [...new Set(collections.flatMap((collection) => [...collection.recordIds]))];
  const records = await getPublishedByIds(ids);
  const byId = new Map(records.map((record) => [record.id, record]));
  return collections.map((collection) => summarize(
    collection,
    collection.recordIds.map((id) => byId.get(id)).filter((record): record is StoredMeme => record !== undefined),
  ));
}

export async function getCollectionSummary(slug: string): Promise<CollectionSummary | null> {
  const collection = getCollection(slug);
  if (!collection) return null;
  return summarize(collection, await getPublishedByIds([...collection.recordIds]));
}
