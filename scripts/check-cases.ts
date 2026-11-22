// Verdicts for chain states the live accounts don't cover, from stubbed REST and RPC answers. Run: pnpm check:cases
import { checkup } from "../src/lib/check";
import { REGISTRATION, summarise, type TxResponse } from "../src/lib/registrations";

const A = "qor1qf506wld3t970g56nhdenu9j2pmwuuxd472h6k";
type State = { pubkey?: boolean; pqc?: "none" | "unproven" | "proven"; kem?: boolean; window?: Partial<Record<string, unknown>>; nonce?: number };
const stub = (s: State): typeof fetch => (async (url: string) => {
  const u = String(url);
  const body =
    u.includes("/auth/") ? { account: s.pubkey ? { pub_key: { key: "x" } } : {} } :
    u.includes("/pqc/v1/account/") ? (s.pqc === "none" || !s.pqc ? { found: false } : { found: true, account: { possession_proven: s.pqc === "proven", algorithm_name: "dilithium5" } }) :
    u.includes("/pqc/v1/kem/") ? { found: !!s.kem } :
    u.includes("/balances/") ? { balance: { amount: "5000000" } } :
    u.includes("/evm_window/") ? { found: !!s.window, live: !!s.window, opened_height: "1", expiry_height: "2", max_txs: "10", used_txs: "0", max_value: "9000000", used_value: "0",
      remaining_blocks: "100", remaining_txs: "10", remaining_value: "9000000", native_only: false, allowed_targets: [], validators: [], staking_validators: [], ibc_receivers: [], ...(s.window ?? {}) } :
    { result: `0x${(s.nonce ?? 0).toString(16)}` };
  return new Response(JSON.stringify(body), { status: 200 });
}) as any;

let failed = 0;
async function expect(name: string, s: State, level: string, fixes: Record<string, string | undefined> = {}) {
  const r = await checkup(A, { rest: "http://x", evmRpc: "http://x", fetch: stub(s) });
  const got = Object.fromEntries(r.findings.map((f) => [f.id, `${f.level}${f.fix ? `/${f.fix}` : ""}`]));
  const good = r.level === level && Object.entries(fixes).every(([k, v]) => got[k] === v);
  console.log(`  ${good ? "✓" : "✗"} ${name}: ${r.level}  ${JSON.stringify(got)}`);
  if (!good) failed++;
}

await expect("fresh account, never signed", {}, "watch", { classical: "safe", pqc: "watch/register-pqc" });
await expect("signed classically, no PQC key", { pubkey: true }, "exposed", { classical: "exposed", pqc: "exposed/register-pqc" });
await expect("key without proof of possession", { pubkey: true, pqc: "unproven", kem: true }, "watch", { classical: "watch", pqc: "watch/register-pqc" });
await expect("fully set up", { pubkey: true, pqc: "proven", kem: true }, "safe", { classical: "safe", pqc: "safe", window: "safe", kem: "safe" });
await expect("never signed, key and KEM registered elsewhere", { pqc: "proven", kem: true }, "safe");
await expect("open window to any target", { pubkey: true, pqc: "proven", kem: true, window: {} }, "exposed", { classical: "safe", window: "exposed/narrow-window" });
await expect("long window, even if scoped", { pubkey: true, pqc: "proven", kem: true, window: { allowed_targets: ["0xabc"], remaining_blocks: "10000" } }, "exposed", { window: "exposed/narrow-window" });
await expect("short scoped window", { pubkey: true, pqc: "proven", kem: true, window: { allowed_targets: ["0xabc"] } }, "watch", { window: "watch/close-window" });
await expect("EVM nonce reveals the key, no PQC key", { nonce: 3 }, "exposed", { classical: "exposed" });

// The live registrations panel: only successful registrations count, and "hybrid" means the ML-DSA-87 layer was there.
const tx = (code: number, hybrid: boolean, type = REGISTRATION, where: "extension_options" | "non_critical_extension_options" = "extension_options"): TxResponse =>
  ({ code, height: "10", timestamp: "2026-11-22T00:00:00Z", tx: { body: { messages: [{ "@type": type }], [where]: hybrid ? [{ "@type": "/qorechain.pqc.v1.PQCHybridSignature" }] : [] } } });
const sum = summarise([tx(0, false), tx(0, true), tx(0, true, REGISTRATION, "non_critical_extension_options"), tx(5, false), tx(0, false, "/cosmos.bank.v1beta1.MsgSend")]);
const sumOk = sum.sampled === 3 && sum.classical === 1 && sum.hybrid === 2;
console.log(`  ${sumOk ? "✓" : "✗"} registrations: failed txs and other messages are ignored  ${JSON.stringify({ sampled: sum.sampled, classical: sum.classical, hybrid: sum.hybrid })}`);
if (!sumOk) failed++;

if (failed) { console.error(`${failed} cases failed`); process.exit(1); }
console.log("every case gets the expected verdict");
