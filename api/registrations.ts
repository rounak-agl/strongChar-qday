// GET /api/registrations: how diana's last 50 post-quantum key registrations were signed. Counted here rather than in
// the browser so a visitor downloads a few bytes instead of 1 MB of transactions; the CDN keeps it for 5 minutes.
import { recentRegistrations } from "../src/lib/registrations.js";

const REST = "https://api-testnet.qore.host";

export async function GET(): Promise<Response> {
  try {
    const body = { ...(await recentRegistrations(REST)), checkedAt: new Date().toISOString() };
    return Response.json(body, { headers: { "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
