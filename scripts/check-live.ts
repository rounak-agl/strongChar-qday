// Run the checkup against real diana accounts and print the verdicts. Run: pnpm check:live
import { checkup } from "../src/lib/check";
const src = { rest: "https://api-testnet.qore.host", evmRpc: "https://evm-testnet.qore.host" };
const accounts = process.argv.slice(2);
for (const a of accounts) {
  const r = await checkup(a, src);
  console.log(`\n${r.qor}  ${r.evm}  ${r.level.toUpperCase()}  ${(Number(r.uqor) / 1e6).toFixed(4)} QOR  nonce ${r.evmNonce}`);
  for (const f of r.findings) console.log(`  [${f.level}] ${f.title}${f.fix ? `  (fix: ${f.fix})` : ""}`);
}
