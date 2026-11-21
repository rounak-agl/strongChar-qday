import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { keccak256, toBytes } from "viem";
import { useAccount } from "wagmi";
import { checkup, normalise, type Finding, type Level, type Report } from "./lib/check.js";
import { closeWindow, narrowWindow, qorexCanSend, qorexInstalled, qorexNativeAddress, signCheckup } from "./lib/qorex.js";

const SOURCES = { rest: "/lcd-testnet", evmRpc: "https://evm-testnet.qore.host" };
const EXPLORER = "https://explore.qore.network/tx/";
const VERDICT: Record<Level, { word: string; line: string }> = {
  safe: { word: "Ready", line: "Nothing this account has made public gives a quantum computer control of it." },
  watch: { word: "Watch", line: "Nothing can be taken today, but some of this account's protection rests on classical keys." },
  exposed: { word: "Exposed", line: "On Q-Day, someone who derives this account's secp256k1 key could act as it." },
};
const LEVEL_LABEL: Record<Level, string> = { safe: "fine", watch: "watch", exposed: "exposed" };

export function App() {
  const { address: evmAddress } = useAccount();
  const [input, setInput] = useState("");
  const [native, setNative] = useState<string | null>(null);
  const [connectErr, setConnectErr] = useState<string | null>(null);

  const run = useMutation({ mutationFn: (a: string) => checkup(a, SOURCES) });
  const check = (a: string) => { setInput(a); setConnectErr(null); run.mutate(a); };

  useEffect(() => {
    const a = new URLSearchParams(location.search).get("address");
    if (a) check(a);
  }, []);
  useEffect(() => { if (run.data) history.replaceState(null, "", `?address=${run.data.qor}`); }, [run.data]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    try { normalise(input); } catch (err) { run.reset(); setConnectErr((err as Error).message); return; }
    check(input.trim());
  };
  const useQorex = async () => {
    setConnectErr(null);
    try { const a = await qorexNativeAddress(); setNative(a); check(a); } catch (err) { setConnectErr((err as Error).message); }
  };

  return (
    <div className="page">
      <header className="top">
        <a className="mark" href="/">Q-Day checkup</a>
        <ConnectButton chainStatus="none" showBalance={false} accountStatus="address" label="Connect QoreX (EVM)" />
      </header>

      <section className="intro">
        <h1>What could a quantum computer do with your account?</h1>
        <p>
          A large enough quantum computer turns any public secp256k1 key into its private key. This reads what your
          QoreChain account has already made public on the diana testnet, tells you what that key could still do, and
          lets you fix it from QoreX with a hybrid ML-DSA-87 signature.
        </p>
        <form className="ask" onSubmit={submit}>
          <label htmlFor="addr">Account</label>
          <div className="row">
            <input id="addr" value={input} onChange={(e) => setInput(e.target.value)} placeholder="qor1… or 0x…" spellCheck={false} autoComplete="off" />
            <button type="submit" disabled={run.isPending || !input.trim()}>{run.isPending ? "Checking…" : "Check"}</button>
          </div>
          <div className="quick">
            <button type="button" className="link" onClick={useQorex} disabled={run.isPending || !qorexInstalled()}>
              {qorexInstalled() ? "Check my QoreX account" : "QoreX isn't installed in this browser"}
            </button>
            {evmAddress && <button type="button" className="link" onClick={() => check(evmAddress)}>Check my connected EVM address</button>}
          </div>
          {connectErr && <p className="err" role="alert">{connectErr}</p>}
        </form>
      </section>

      {run.error && <p className="err" role="alert">Couldn't read the chain: {(run.error as Error).message}</p>}
      {run.data && <ReportView r={run.data} canFix={native === run.data.qor} onRecheck={() => check(run.data!.qor)} />}

      <footer className="foot">
        Reads diana's public REST API and EVM RPC. Nothing leaves your browser except those reads and what you approve
        in QoreX. Testnet only. Source: <a href="https://github.com/rounak-agl/strongChar-qday">strongChar-qday</a>.
      </footer>
    </div>
  );
}

function ReportView({ r, canFix, onRecheck }: { r: Report; canFix: boolean; onRecheck: () => void }) {
  const v = VERDICT[r.level];
  return (
    <section className={`report lvl-${r.level}`} aria-live="polite">
      <div className="verdict">
        <p className="word">{v.word}</p>
        <div>
          <p className="line">{v.line}</p>
          <p className="who"><code>{r.qor}</code> <span>is also</span> <code>{r.evm}</code></p>
          <p className="meta">{(Number(r.uqor) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 4 })} QOR, checked at {r.checkedAt.toLocaleTimeString()}</p>
        </div>
      </div>
      <ol className="findings">
        {r.findings.map((f) => <FindingRow key={f.id} f={f} r={r} canFix={canFix} onDone={onRecheck} />)}
      </ol>
      <SignCheckup r={r} canFix={canFix} />
      {!canFix && <p className="hint">To fix anything here, use <strong>Check my QoreX account</strong>: QoreX can only sign for its own address.</p>}
    </section>
  );
}

function useSend(onDone?: () => void) {
  return useMutation({ mutationFn: (f: () => Promise<{ txHash: string; shield: string }>) => f(), onSuccess: () => setTimeout(() => onDone?.(), 1500) });
}

function Sent({ s }: { s: ReturnType<typeof useSend> }) {
  if (s.error) return <p className="err" role="alert">{(s.error as Error).message}</p>;
  if (!s.data) return null;
  const shield = s.data.shield === "shielded" ? "with the ML-DSA-87 layer in the committed transaction."
    : s.data.shield === "downgraded" ? "but QoreX reports it was committed without the ML-DSA-87 layer." : "while QoreX confirms the ML-DSA-87 layer.";
  return <p className="sent">Sent <a href={EXPLORER + s.data.txHash} target="_blank" rel="noreferrer">{s.data.txHash.slice(0, 12)}…</a> {shield}</p>;
}

function FindingRow({ f, r, canFix, onDone }: { f: Finding; r: Report; canFix: boolean; onDone: () => void }) {
  const s = useSend(onDone);
  const ready = canFix && qorexCanSend();
  return (
    <li className={`finding lvl-${f.level}`}>
      <span className="tag">{LEVEL_LABEL[f.level]}</span>
      <div className="body">
        <h2>{f.title}</h2>
        <p>{f.detail}</p>
        {f.fix === "register-pqc" && <p className="todo">To fix: open QoreX on this account and register its post-quantum key. Only the wallet can do this; no site can ask for it. Then check again.</p>}
        {f.fix && f.fix !== "register-pqc" && ready && (
          <div className="fixes">
            <button disabled={s.isPending} onClick={() => s.mutate(() => closeWindow(r.qor))}>{s.isPending ? "Approve in QoreX…" : "Close the window"}</button>
            {f.fix === "narrow-window" && <button className="quiet" disabled={s.isPending} onClick={() => s.mutate(() => narrowWindow(r.qor, { maxUqor: 2_000_000n, target: r.window.allowedTargets[0] }))}>Narrow it to one transaction for an hour</button>}
          </div>
        )}
        <Sent s={s} />
      </div>
    </li>
  );
}

function SignCheckup({ r, canFix }: { r: Report; canFix: boolean }) {
  const s = useSend();
  if (!canFix || !qorexCanSend()) return null;
  const summary = r.findings.map((f) => `${f.id}:${f.level}`).join(",");
  const hash = keccak256(toBytes(`${r.qor}|${summary}|${r.checkedAt.toISOString()}`)).slice(0, 18);
  const memo = `q-day:${r.level} ${summary} ${hash}`;
  return (
    <div className="stamp">
      <div>
        <h2>Put this checkup on chain</h2>
        <p>A 1 uqor transfer to yourself, hybrid-signed by QoreX, with the verdict in the memo: <code>{memo}</code></p>
      </div>
      <button disabled={s.isPending || !!s.data} onClick={() => s.mutate(() => signCheckup(r.qor, memo))}>{s.isPending ? "Approve in QoreX…" : s.data ? "Recorded" : "Sign and record"}</button>
      <Sent s={s} />
    </div>
  );
}
