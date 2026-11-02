import { Client } from "@elastic/elasticsearch";
import { config } from "../config";

const INDEX = "emails";
export const es = new Client({ node: config.esUrl });

export async function initSearch() {
  try {
    const exists = await es.indices.exists({ index: INDEX });
    if (!exists) {
      await es.indices.create({
        index: INDEX,
        mappings: {
          properties: {
            userId: { type: "integer" },
            to: { type: "keyword" },
            subject: { type: "text" },
            body: { type: "text" },
            status: { type: "keyword" },
            scheduledAt: { type: "date" },
            sentAt: { type: "date" },
          },
        },
      });
    }
  } catch (e) {
    console.warn("[search] Elasticsearch unavailable, search disabled:", (e as Error).message);
  }
}

export interface EmailDoc {
  id: number; userId: number; to: string; subject: string; body: string;
  status: string; scheduledAt: Date; sentAt?: Date | null;
}

/** Fail-soft: search is a secondary view, so ES being down must never break sending. */
export async function indexEmails(docs: EmailDoc[]) {
  if (!docs.length) return;
  try {
    const operations = docs.flatMap((d) => [{ index: { _index: INDEX, _id: String(d.id) } }, d]);
    await es.bulk({ operations, refresh: false });
  } catch (e) {
    console.warn("[search] index failed:", (e as Error).message);
  }
}

export async function updateStatus(id: number, status: string, sentAt?: Date) {
  try {
    await es.update({ index: INDEX, id: String(id), doc: { status, sentAt } });
  } catch { /* ignore */ }
}

export async function searchEmails(userId: number, q: string, status?: string) {
  const filter: any[] = [{ term: { userId } }];
  if (status) filter.push({ term: { status } });
  const res = await es.search({
    index: INDEX,
    size: 100,
    query: { bool: { must: [{ multi_match: { query: q, fields: ["subject", "body", "to"], fuzziness: "AUTO" } }], filter } },
  });
  return res.hits.hits.map((h) => h._source as EmailDoc);
}
