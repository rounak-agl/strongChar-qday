// Screen recordings of the checkup for the film: real diana accounts, typed and checked like a person would.
// Run from the repo root with the dev server up: node video/scripts/record.mjs
import { createQorexMock } from "@qorechain/qorex-wallet-mock";
import { chromium } from "playwright";
import { mkdirSync, renameSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const OUT = new URL("../public/clips/", import.meta.url).pathname;
const SIZE = { width: 1920, height: 1080 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function clip(name, run, { mock = false } = {}) {
  const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT, size: SIZE }, colorScheme: "light", deviceScaleFactor: 1 });
  if (mock) await ctx.addInitScript({ content: createQorexMock({ profile: "current", autoApprove: false }).initScript() });
  const page = await ctx.newPage();
  await page.addInitScript(() => { document.documentElement.style.zoom = "1.35"; });
  await run(page);
  const v = page.video();
  await ctx.close();
  renameSync(await v.path(), `${OUT}${name}.webm`);
  console.log("recorded", name);
}

const check = async (page, addr) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator("#addr").click();
  await page.locator("#addr").pressSequentially(addr, { delay: 28 });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.locator(".word").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(700);
};
const glide = async (page, px, ms) => {
  await page.evaluate(async ([px, ms]) => {
    const y0 = scrollY, t0 = performance.now();
    await new Promise((res) => { const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; scrollTo(0, y0 + px * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
  }, [px, ms]);
};

await clip("ready", async (page) => {
  await check(page, "qor19qt2u8zfnr9achcn7rydtvrsuga6symwgp2khl");
  await glide(page, 760, 2200); await page.waitForTimeout(2200);
  await glide(page, 700, 2200); await page.waitForTimeout(2600);
});
await clip("fresh", async (page) => {
  await check(page, "qor1kng7tv83qesgvv2ze7hxlw4urfrjk8vq5ckrcf");
  await glide(page, 760, 2200); await page.waitForTimeout(2200);
  await glide(page, 700, 2200); await page.waitForTimeout(2600);
});
await clip("qorex", async (page) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Check my QoreX account" }).click();
  await page.waitForFunction(() => window.__qorexMock.pendingApprovals > 0);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__qorexMock.approveNext());
  await page.locator(".word").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(900);
  await glide(page, 900, 2400); await page.waitForTimeout(1500);
  await glide(page, 1100, 2600); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Sign and record" }).hover();
  await page.waitForTimeout(2500);
}, { mock: true });
await browser.close();
