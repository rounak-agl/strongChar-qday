// The three fixes against the QoreX test double with today's QoreX behaviour. The user refuses each transaction, so
// nothing is broadcast or spent; the check is that each asks QoreX for exactly the messages it should.
// Run: pnpm check:qorex
import { createQorexMock } from "@qorechain/qorex-wallet-mock";
import { qorechainRegistry } from "@qorechain/sdk";
import { closeWindow, narrowWindow, qorexCanSend, qorexNativeAddress, signCheckup } from "../src/lib/qorex";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`); if (!cond) failed++; };
const registry = qorechainRegistry();

const g = globalThis as any;
g.window = g;
const events = new EventTarget();
for (const k of ["addEventListener", "removeEventListener", "dispatchEvent"] as const) g[k] = events[k].bind(events);
ok("no wallet: fixes are not offered", !qorexCanSend());

const mock = createQorexMock({ profile: "current", autoApprove: false });
const ctl = mock.install(g);
const waitApproval = async () => { for (let i = 0; i < 150 && ctl.pendingApprovals === 0; i++) await new Promise((r) => setTimeout(r, 20)); return ctl.pendingApprovals; };
ok("mock installed: fixes are offered", qorexCanSend());
const addr = qorexNativeAddress();
await waitApproval(); ctl.approveNext();
const me = await addr;
ok("reads the wallet's native address", me === mock.addresses().native, me);

async function refused(name: string, f: () => Promise<unknown>) {
  ctl.clearRequests();
  const p = f().then(() => "sent", (e: Error) => e.message);
  ok(`${name}: waits for approval`, (await waitApproval()) === 1);
  ctl.rejectNext();
  ok(`${name}: refusal reaches the page`, (await p) !== "sent");
  const req = ctl.requests.find((r) => r.method === "native:signAndBroadcast");
  const params = (req?.params as any) ?? {};
  const msgs = (params.messages ?? params[0]?.messages ?? []) as { typeUrl: string; value: Record<string, number> }[];
  return { memo: params.memo ?? params[0]?.memo, msgs: msgs.map((m) => ({ typeUrl: m.typeUrl, value: registry.decode({ typeUrl: m.typeUrl, value: Uint8Array.from(Object.values(m.value)) }) as any })) };
}

let r = await refused("close window", () => closeWindow(me));
ok("close window: one MsgCloseEVMWindow from this account", r.msgs.length === 1 && r.msgs[0].typeUrl.endsWith("MsgCloseEVMWindow") && r.msgs[0].value.sender === me, r.msgs.map((m) => m.typeUrl).join(", "));

const target = "0x03b2e6c1C0aD0A4C5e8bE3D5d8a4F8A0b1C2bc84";
r = await refused("narrow window", () => narrowWindow(me, { maxUqor: 2_000_000n, target }));
const open = r.msgs[1]?.value;
ok("narrow window: close then open, in one transaction", r.msgs.length === 2 && r.msgs[0].typeUrl.endsWith("MsgCloseEVMWindow") && r.msgs[1].typeUrl.endsWith("MsgOpenEVMWindow"), r.msgs.map((m) => m.typeUrl).join(", "));
ok("narrow window: 720 blocks, 1 transaction, 2 QOR, one target", !!open && String(open.blocks) === "720" && String(open.maxTxs) === "1" && open.maxValue === "2000000"
  && (open.allowedTargets ?? []).length === 1 && open.allowedTargets[0].toLowerCase() === target.toLowerCase(), open ? JSON.stringify({ blocks: String(open.blocks), maxTxs: String(open.maxTxs), maxValue: open.maxValue, targets: open.allowedTargets }) : "");

r = await refused("record checkup", () => signCheckup(me, "q-day:watch classical:watch,pqc:safe,window:safe,kem:watch 0x1234"));
const sendMsg = r.msgs[0]?.value;
ok("record checkup: 1 uqor to itself with the verdict memo", r.msgs.length === 1 && sendMsg?.fromAddress === me && sendMsg?.toAddress === me
  && sendMsg?.amount?.[0]?.amount === "1" && String(r.memo).startsWith("q-day:watch"), String(r.memo));

if (failed) { console.error(`${failed} checks failed`); process.exit(1); }
console.log("every fix asks QoreX for exactly the right transaction");
