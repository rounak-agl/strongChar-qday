# Project form: Q-Day checkup (Quantum Pass)

Everything to paste into a new project on build.qorechain.io ("My space" → "New project").

**Name:** Q-Day checkup

**Tagline:** What could a quantum computer do with your QoreChain account? Check it, then fix it from QoreX.

**Category:** Quantum Pass

**Description:**

A quantum computer large enough to run Shor's algorithm turns any public secp256k1 key into its private key. Q-Day
checkup reads what a QoreChain account has already made public on the diana testnet and tells you, in plain words, what
that key could still do: whether its public key is on chain, whether a proven ML-DSA-87 key protects it, whether an
open EVM window lets the classical key spend alone, and whether anyone can seal data to it with ML-KEM-1024. Then it
lets you fix what it found from QoreX, with transactions QoreX signs with secp256k1 and ML-DSA-87 together: close or
narrow an EVM window, or put the checkup itself on chain.

Before writing a word of the verdicts, it measured the chain: none of the last 500 successful transfers was signed
classically alone, but 49 of the last 50 post-quantum key registrations were. So until an account registers its own
ML-DSA-87 key, whoever registers one first controls it after Q-Day. The checkup says so, and tells you how to fix it.

**How it's made:**

- Scaffolded with `create-qorechain-dapp` (viem-wagmi template): Vite, React, wagmi and RainbowKit, with QoreX through
  `@qorechain/qorex-rainbowkit` for the EVM lane and `@qorechain/qorex-types` for the native lane.
- The checkup reads diana's REST API (account public key, `qorechain/pqc/v1/account`, `kem`, `evm_window` via
  `evmWindowStatus` from `@qorechain/evm`) and the EVM RPC (nonce). The REST API sends no CORS headers, so Vercel
  rewrites exactly the four read paths the page uses; nothing else is proxied.
- Fixes are native-lane messages built with `@qorechain/sdk` (`MsgCloseEVMWindow`, `MsgOpenEVMWindow`, `MsgSend`) and
  sent with QoreX's `signAndBroadcast`, which adds the ML-DSA-87 layer and reports whether the committed transaction
  kept it. Registering a post-quantum key is wallet-only, so the page sends you to QoreX for that.
- Tests: stubbed chain states pin every verdict; every fix runs against `@qorechain/qorex-wallet-mock` with the user
  refusing, so nothing is spent; a daily Playwright run checks the live site.
- Hard part: deciding verdicts that are true. A first draft rated every account that had ever transacted as at risk
  forever; the rule now accounts for the hybrid-signature requirement once a proven ML-DSA-87 key is registered.

**Cover image:** `docs/cover/cover.png` (1600×900)

**Public GitHub repository:** https://github.com/rounak-agl/strongChar-qday

**Demo:** https://strongchar-qday.vercel.app

**Video:** upload `video/out/qday-checkup.mp4` (70 s) and paste the link

**Testnet addresses:** your QoreX address, after you've made one hybrid-signed transaction from it in the app
("Check my QoreX account" → "Sign and record")

**Kits and SDKs used (tick):**
- QoreChain SDK: TypeScript (`@qorechain/sdk`), TypeScript (`@qorechain/evm`)
- create-qorechain-dapp: TypeScript (CLI)
- QoreX integrations: `@qorechain/qorex-types`, `@qorechain/qorex-rainbowkit`, `@qorechain/qorex-wallet-mock`

**Network features (tick only what your transaction exercises):**
- Hybrid ML-DSA-87 transactions (any fix or "Sign and record" from QoreX)
- EVM window (incl. scoped), only if you close or narrow a window from the app

**Special awards:** AI-Native (AI_USAGE.md is in the repo); Regional: India
