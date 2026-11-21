// The live checkup in a real browser with the QoreX test double injected: real accounts get the verdicts the chain
// supports, and the QoreX account's fixes are offered and refused. Nothing is signed or spent.
// Run: SMOKE_URL=https://strongchar-qday.vercel.app pnpm smoke   (default: the local dev server)
import { createQorexMock } from "@qorechain/qorex-wallet-mock";
import { chromium } from "playwright";

const BASE = (process.env.SMOKE_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`); if (!cond) failed++; };

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addInitScript({ content: createQorexMock({ profile: "current", autoApprove: false }).initScript() });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  // A fully set-up account (strongChar's coordinator) and one that has never signed anything.
  for (const [addr, want] of [["qor19qt2u8zfnr9achcn7rydtvrsuga6symwgp2khl", "Ready"], ["qor1kng7tv83qesgvv2ze7hxlw4urfrjk8vq5ckrcf", "Watch"]] as const) {
    await page.goto(`${BASE}/?address=${addr}`, { timeout: 60_000 });
    await page.locator(".word").waitFor({ timeout: 60_000 });
    ok(`${addr.slice(0, 12)}… reads ${want}`, (await page.locator(".word").innerText()) === want, await page.locator(".word").innerText());
  }
  ok("the 0x form gives the same account", await page.goto(`${BASE}/?address=0x2816Ae1c4998CBdc5F13F0c8d5b070e23ba8136e`).then(() => page.locator(".who code").first().innerText({ timeout: 60_000 })) === "qor19qt2u8zfnr9achcn7rydtvrsuga6symwgp2khl");

  await page.goto(BASE, { timeout: 60_000 });
  await page.getByRole("button", { name: "Check my QoreX account" }).click();
  await page.waitForFunction(() => (window as any).__qorexMock.pendingApprovals > 0, null, { timeout: 30_000 });
  await page.evaluate(() => (window as any).__qorexMock.approveNext());
  await page.locator(".word").waitFor({ timeout: 60_000 });
  const record = page.getByRole("button", { name: "Sign and record" });
  ok("fixes are offered for the QoreX account", await record.isVisible());
  await record.click();
  await page.waitForFunction(() => (window as any).__qorexMock.pendingApprovals > 0, null, { timeout: 30_000 });
  await page.evaluate(() => (window as any).__qorexMock.rejectNext());
  await page.getByText("QoreX: signature rejected").waitFor({ timeout: 30_000 }).then(() => ok("a refusal in QoreX is shown", true), () => ok("a refusal in QoreX is shown", false));
} finally {
  await browser.close();
}
ok("no script errors", errors.length === 0, errors.slice(0, 2).join(" | "));
if (failed) { console.error(`${failed} smoke checks failed`); process.exit(1); }
console.log(`smoke run passed against ${BASE}`);
