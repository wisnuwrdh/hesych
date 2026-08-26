// Minimal Cloudflare D1 REST client - server-side only.
//
// Uses the D1 HTTP API instead of runtime bindings so the license endpoints
// work identically whether the worker runs on Pages, Workers, or dev.
// Required env vars (Pages dashboard → Settings → Environment variables):
//   CF_ACCOUNT_ID, D1_DATABASE_ID, CF_D1_API_TOKEN

const ACC = process.env.CF_ACCOUNT_ID;
const DB = process.env.D1_DATABASE_ID;
const TOK = process.env.CF_D1_API_TOKEN;

export function d1Configured(): boolean {
  return Boolean(ACC && DB && TOK);
}

export async function d1Query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!d1Configured()) throw new Error("D1 not configured");
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database/${DB}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOK}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const json = (await res.json()) as {
    success: boolean;
    errors?: Array<{ message: string }>;
    result?: Array<{ results: T[] }>;
  };
  if (!json.success || !json.result) {
    throw new Error(json.errors?.[0]?.message ?? `D1 query failed (${res.status})`);
  }
  return json.result[0]?.results ?? [];
}
