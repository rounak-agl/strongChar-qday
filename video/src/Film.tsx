// The Q-Day checkup film: a hook, three live checkups recorded from the app, what was measured on diana, the end card.
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/600.css";
import "@fontsource/schibsted-grotesk/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import type { ReactNode } from "react";
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";

export const FPS = 30;
const C = { paper: "#e8ece9", sheet: "#f6f8f6", ink: "#15211c", muted: "#55625c", rule: "#c9d1cc", safe: "#2b7653", watch: "#9a6511", exposed: "#b3261e", teal: "#0f5257" };
const SANS = "'Schibsted Grotesk', sans-serif", MONO = "'IBM Plex Mono', monospace";
const s = (sec: number) => Math.round(sec * FPS);

type Scene = { len: number; node: ReactNode };
const SCENES: Scene[] = [
  { len: s(6.5), node: <Hook /> },
  { len: s(4), node: <Title /> },
  { len: s(15), node: <Clip src="clips/ready.webm" from={0.3} captions={[
    [0, "A fully set-up account on diana"],
    [6.5, "Its public key is on chain, but with a proven ML-DSA-87 key it can't act alone"],
  ]} /> },
  { len: s(14.5), node: <Clip src="clips/fresh.webm" from={0.6} captions={[
    [0, "An account that has never signed anything"],
    [6.5, "Its key is still private. But with no ML-DSA-87 key, the classical key alone could register one first"],
  ]} /> },
  { len: s(9), node: <Facts /> },
  { len: s(15), node: <Clip src="clips/real.webm" from={0.5} captions={[
    [0, "A real QoreX account on diana, checked after its fix"],
    [5, "QoreX registered its ML-DSA-87 key with proof of possession, so the classical key can't act alone"],
    [10.5, "Still to do: no ML-KEM-1024 key, so nothing can be sealed to it yet"],
  ]} /> },
  { len: s(8), node: <Receipt /> },
  { len: s(6), node: <End /> },
];
const FADE = s(0.6);
export const TOTAL = SCENES.reduce((n, x) => n + x.len, 0);

export function Film() {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: SANS, color: C.ink }}>
      {SCENES.map((x, i) => { const from = at; at += x.len; return <Sequence key={i} from={from} durationInFrames={x.len}><Fade len={x.len}>{x.node}</Fade></Sequence>; })}
      <Audio src={staticFile("score.wav")} volume={(f) => interpolate(f, [0, s(2), TOTAL - s(3), TOTAL], [0, 0.55, 0.55, 0], { extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
}

function Fade({ len, children }: { len: number; children: ReactNode }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, FADE, len - FADE, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

const rise = (f: number, at: number) => ({
  opacity: interpolate(f, [at, at + s(0.5)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  transform: `translateY(${interpolate(f, [at, at + s(0.6)], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px)`,
});

function Hook() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: "0 180px", justifyContent: "center", gap: 48 }}>
      <p style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0, maxWidth: 1400, ...rise(f, s(0.3)) }}>
        A quantum computer turns a public key into its private key.
      </p>
      <p style={{ fontSize: 56, fontWeight: 600, color: C.exposed, margin: 0, letterSpacing: "-0.02em", ...rise(f, s(3)) }}>
        Which of your keys are already public?
      </p>
    </AbsoluteFill>
  );
}

function Title() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 28 }}>
      <p style={{ fontSize: 150, fontWeight: 800, letterSpacing: "-0.045em", margin: 0, ...rise(f, s(0.2)) }}>Q-Day checkup</p>
      <p style={{ fontFamily: MONO, fontSize: 34, color: C.teal, margin: 0, ...rise(f, s(0.9)) }}>strongchar-qday.vercel.app</p>
    </AbsoluteFill>
  );
}

function Clip({ src, from, captions, note }: { src: string; from: number; captions: [number, string][]; note?: string }) {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, s(15)], [1.18, 1.24]);
  const cur = [...captions].reverse().find(([at]) => f >= s(at));
  const capAt = cur ? s(cur[0]) : 0;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 45%" }}>
        <OffthreadVideo src={staticFile(src)} startFrom={s(from)} muted />
      </AbsoluteFill>
      {cur && (
        <div key={capAt} style={{ position: "absolute", left: 120, right: 120, bottom: 72, display: "flex", justifyContent: "center" }}>
          <p style={{ margin: 0, background: C.ink, color: C.sheet, fontSize: 38, fontWeight: 600, padding: "18px 30px", borderRadius: 8,
            maxWidth: 1500, textAlign: "center", lineHeight: 1.3, boxShadow: "0 10px 30px rgba(21,33,28,.25)", ...rise(f, capAt) }}>{cur[1]}</p>
        </div>
      )}
      {note && <p style={{ position: "absolute", top: 36, right: 48, margin: 0, fontFamily: MONO, fontSize: 22, color: C.muted, background: C.sheet,
        border: `1px solid ${C.rule}`, padding: "8px 14px", borderRadius: 6 }}>{note}</p>}
    </AbsoluteFill>
  );
}

function Facts() {
  const f = useCurrentFrame();
  const row = (at: number, big: string, small: string, color: string) => (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 40, alignItems: "baseline", ...rise(f, s(at)) }}>
      <span style={{ fontSize: 110, fontWeight: 800, letterSpacing: "-0.04em", color }}>{big}</span>
      <span style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.25 }}>{small}</span>
    </div>
  );
  return (
    <AbsoluteFill style={{ padding: "0 180px", justifyContent: "center", gap: 36 }}>
      <p style={{ fontFamily: MONO, fontSize: 28, color: C.muted, margin: 0, ...rise(f, s(0.2)) }}>Measured on diana, 22 Nov</p>
      {row(0.8, "0/500", "recent transfers were signed with a classical key alone", C.safe)}
      {row(2.6, "50/50", "latest post-quantum key registrations were accepted with a secp256k1 signature alone. The page counts it live", C.exposed)}
      <p style={{ fontSize: 46, fontWeight: 600, margin: "12px 0 0", maxWidth: 1450, lineHeight: 1.25, ...rise(f, s(4.8)) }}>
        So until an account registers its own ML-DSA-87 key, whoever registers one first controls it after Q-Day.
      </p>
    </AbsoluteFill>
  );
}

// The fix as it landed on chain, from the transaction itself (diana, 22 Nov 2026).
function Receipt() {
  const f = useCurrentFrame();
  const line = (at: number, k: string, v: string, mono = true) => (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 36, alignItems: "baseline", ...rise(f, s(at)) }}>
      <span style={{ fontSize: 30, color: C.muted }}>{k}</span>
      <span style={{ fontFamily: mono ? MONO : SANS, fontSize: mono ? 34 : 40, fontWeight: mono ? 500 : 600, overflowWrap: "anywhere" }}>{v}</span>
    </div>
  );
  return (
    <AbsoluteFill style={{ padding: "0 180px", justifyContent: "center", gap: 30 }}>
      <p style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 10px", ...rise(f, s(0.2)) }}>The fix, on chain</p>
      {line(0.9, "key registered", "block 10,537,517, proof of possession")}
      {line(1.8, "checkup recorded", "tx 1619C021…4C23, block 10,537,520")}
      {line(2.7, "memo", "q-day:watch classical:safe,pqc:watch,window:safe,kem:watch")}
      {line(3.6, "signed with", "secp256k1 and ML-DSA-87 together", false)}
    </AbsoluteFill>
  );
}

function End() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 26, textAlign: "center" }}>
      <p style={{ fontSize: 110, fontWeight: 800, letterSpacing: "-0.045em", margin: 0, ...rise(f, s(0.1)) }}>Check yours before Q-Day.</p>
      <p style={{ fontFamily: MONO, fontSize: 36, color: C.teal, margin: 0, ...rise(f, s(0.7)) }}>strongchar-qday.vercel.app</p>
      <p style={{ fontFamily: MONO, fontSize: 26, color: C.muted, margin: 0, ...rise(f, s(1.2)) }}>github.com/rounak-agl/strongChar-qday</p>
      <p style={{ fontSize: 26, color: C.muted, margin: "18px 0 0", ...rise(f, s(1.7)) }}>Built with create-qorechain-dapp, QoreX and the QoreChain EVM and SDK kits</p>
    </AbsoluteFill>
  );
}
