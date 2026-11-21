// The Q-Day checkup for one QoreChain account: what a future quantum computer could do with what is already public.
// Everything is read from diana's REST API (through the /lcd-testnet proxy) and its EVM RPC; nothing needs a wallet.
import { evmWindowStatus, type EvmWindow } from "@qorechain/evm";
import { evmToQor, qorToEvm } from "@qorechain/sdk";

export type Level = "safe" | "watch" | "exposed";
export type Finding = { id: "classical" | "pqc" | "window" | "kem"; level: Level; title: string; detail: string; fix?: "register-pqc" | "close-window" | "narrow-window" };
export type Report = {
  qor: string; evm: string; uqor: bigint; level: Level; findings: Finding[];
  pqc: { found: boolean; proven: boolean; algorithm?: string; keyType?: string };
  window: EvmWindow; kem: boolean; pubkeyOnChain: boolean; evmNonce: number; checkedAt: Date;
};

export type Sources = { rest: string; evmRpc: string; fetch?: typeof fetch };

const QOR = /^qor1[02-9ac-hj-np-z]{38}$/;
const HEX = /^0x[0-9a-fA-F]{40}$/;

/** A qor1… or 0x… address, as both forms of the same 20-byte account. */
export function normalise(input: string): { qor: string; evm: string } {
  const s = input.trim();
  if (QOR.test(s)) return { qor: s, evm: qorToEvm(s) };
  if (HEX.test(s)) return { qor: evmToQor(s), evm: s };
  throw new Error("Paste a qor1… or 0x… address.");
}

async function json<T>(f: typeof fetch, url: string): Promise<T> {
  const r = await f(url);
  if (!r.ok && r.status !== 404) throw new Error(`${url.split("/").slice(-3, -1).join("/")}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

const blocksToTime = (b: bigint) => {
  const s = Number(b) * 5; // diana makes a block about every 5 s
  return s < 3600 ? `${Math.round(s / 60)} min` : s < 172800 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} days`;
};
const qor = (u: bigint) => `${(Number(u) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 4 })} QOR`;

export async function checkup(input: string, src: Sources): Promise<Report> {
  const f = src.fetch ?? fetch;
  const { qor: addr, evm } = normalise(input);
  const [auth, pqc, kem, bal, window, nonce] = await Promise.all([
    json<{ account?: { pub_key?: unknown } }>(f, `${src.rest}/cosmos/auth/v1beta1/accounts/${addr}`),
    json<{ found?: boolean; account?: { possession_proven?: boolean; algorithm_name?: string; key_type?: string } }>(f, `${src.rest}/qorechain/pqc/v1/account/${addr}`),
    json<{ found?: boolean }>(f, `${src.rest}/qorechain/pqc/v1/kem/${addr}`),
    json<{ balance?: { amount?: string } }>(f, `${src.rest}/cosmos/bank/v1beta1/balances/${addr}/by_denom?denom=uqor`),
    evmWindowStatus({ rest: src.rest, address: addr, fetch: f as any }),
    f(src.evmRpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionCount", params: [evm, "latest"] }) })
      .then((r) => r.json() as Promise<{ result?: string }>).then((r) => Number(r.result ?? "0x0")),
  ]);

  const pubkeyOnChain = !!auth.account?.pub_key || nonce > 0;
  const p = { found: !!pqc.found, proven: !!pqc.account?.possession_proven, algorithm: pqc.account?.algorithm_name, keyType: pqc.account?.key_type };
  const uqor = BigInt(bal.balance?.amount ?? "0");
  const findings: Finding[] = [];

  findings.push(pubkeyOnChain
    ? { id: "classical", level: p.proven ? "safe" : p.found ? "watch" : "exposed",
        title: p.proven ? "Your secp256k1 public key is on chain, but can't act alone" : "Your secp256k1 public key is on chain",
        detail: `It was revealed by the first transaction this account signed. Shor's algorithm turns a public key into its private key, so on Q-Day anyone can sign as this key. ${p.proven ? "With a proven ML-DSA-87 key, the native lane needs both signatures; only an open EVM window would let this key spend on its own." : "What that key can still do is what matters below."}` }
    : { id: "classical", level: "safe", title: "Your secp256k1 public key has never been revealed",
        detail: "Only its hash (the address) is public, which a quantum computer can't invert. The key is revealed the first time this account signs anything." });

  if (!p.found) findings.push({ id: "pqc", level: pubkeyOnChain ? "exposed" : "watch", fix: "register-pqc", title: "No ML-DSA-87 key registered",
    detail: `Until one is, the secp256k1 key alone can register one (diana accepts key registrations signed classically). On Q-Day an attacker who derives the key registers their own ML-DSA-87 key first and takes the account${uqor > 0n ? `, with its ${qor(uqor)}` : ""}.` });
  else if (!p.proven) findings.push({ id: "pqc", level: "watch", fix: "register-pqc", title: "ML-DSA-87 key registered without proof of possession",
    detail: "The chain can't tell this account holds the matching secret key. Contracts that require a proven key (for example through the pqcKeyStatus precompile) will refuse it. Register again with a proof." });
  else findings.push({ id: "pqc", level: "safe", title: `${p.algorithm === "dilithium5" ? "ML-DSA-87" : p.algorithm} key registered, possession proven`,
    detail: "diana requires a hybrid signature from this account for every native transaction (hybrid_signature_mode = required, no classical fallback), so a secp256k1 key alone can't move its funds." });

  const w = window;
  if (w.live) {
    const anyTarget = !w.nativeOnly && w.allowedTargets.length === 0;
    const wide = anyTarget || w.remainingBlocks > 17_280n / 4n;
    findings.push({ id: "window", level: wide ? "exposed" : "watch", fix: wide ? "narrow-window" : "close-window",
      title: `An EVM window is open for ${blocksToTime(w.remainingBlocks)}`,
      detail: `EVM transactions are signed with secp256k1 only. While this window is open, that key alone can send up to ${w.remainingTxs} transactions moving up to ${qor(w.remainingValue)}, ${w.nativeOnly ? "as plain transfers only" : anyTarget ? "to any contract or address" : `only to ${w.allowedTargets.length} listed contract${w.allowedTargets.length > 1 ? "s" : ""}`}. Close it when you aren't using it.` });
  } else findings.push({ id: "window", level: "safe", title: "No EVM window open",
    detail: "The EVM lane refuses transactions from this account, so its secp256k1 key can't spend anything there." });

  findings.push(kem.found
    ? { id: "kem", level: "safe", title: "ML-KEM-1024 encryption key registered", detail: "Others can seal data to this address with QoreSeal so that only its holder can open it, now and after Q-Day." }
    : { id: "kem", level: "watch", title: "No ML-KEM-1024 encryption key", detail: "Nothing can be sealed to this address with post-quantum encryption yet. Data sent to it under classical encryption can be stored now and read on Q-Day." });

  const level: Level = findings.some((x) => x.level === "exposed") ? "exposed" : findings.some((x) => x.level === "watch") ? "watch" : "safe";
  return { qor: addr, evm, uqor, level, findings, pqc: p, window: w, kem: !!kem.found, pubkeyOnChain, evmNonce: nonce, checkedAt: new Date() };
}
