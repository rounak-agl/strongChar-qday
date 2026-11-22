// How diana's recent post-quantum key registrations were signed. An account's first ML-DSA-87 key is accepted on the
// strength of its secp256k1 signature alone, so on Q-Day an account without one belongs to whoever registers first.
// This counts it live from the chain instead of quoting a number measured once.

export const REGISTRATION = "/qorechain.pqc.v1.MsgRegisterPQCKeyV2";
const HYBRID = "/qorechain.pqc.v1.PQCHybridSignature";

type Ext = { "@type": string };
export type TxResponse = {
  code: number; height: string; timestamp: string;
  tx: { body: { messages: { "@type": string }[]; extension_options?: Ext[]; non_critical_extension_options?: Ext[] } };
};
export type Registrations = { sampled: number; classical: number; hybrid: number; newest: string; oldest: string; newestHeight: number };

export const registrationsUrl = (rest: string, n = 50) =>
  `${rest}/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(`message.action='${REGISTRATION}'`)}&order_by=ORDER_BY_DESC&limit=${n}&page=1`;

/** Successful registrations only; "hybrid" means the transaction carried the ML-DSA-87 layer as well. */
export function summarise(txs: TxResponse[]): Registrations {
  const ok = txs.filter((t) => t.code === 0 && t.tx.body.messages.some((m) => m["@type"] === REGISTRATION));
  const layered = (t: TxResponse) =>
    [...(t.tx.body.extension_options ?? []), ...(t.tx.body.non_critical_extension_options ?? [])].some((e) => e["@type"] === HYBRID);
  const hybrid = ok.filter(layered).length;
  return {
    sampled: ok.length, classical: ok.length - hybrid, hybrid,
    newest: ok[0]?.timestamp ?? "", oldest: ok[ok.length - 1]?.timestamp ?? "", newestHeight: Number(ok[0]?.height ?? 0),
  };
}

export async function recentRegistrations(rest: string, f: typeof fetch = fetch, n = 50): Promise<Registrations> {
  // The REST host sits behind Cloudflare, which refuses some default server user agents.
  const r = await f(registrationsUrl(rest, n), { headers: { accept: "application/json", "user-agent": "q-day-checkup" } });
  if (!r.ok) throw new Error(`tx search: HTTP ${r.status}`);
  const body = (await r.json()) as { tx_responses?: TxResponse[] };
  return summarise(body.tx_responses ?? []);
}
