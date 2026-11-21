// Fixes go through QoreX's native lane: QoreX signs every transaction with secp256k1 and ML-DSA-87 together and
// reports whether the committed transaction kept the post-quantum layer (`shield`).
import { getQorexNative, hasCapability, qorexSignAndBroadcast, type QorexSignAndBroadcastResult } from "@qorechain/qorex-types";
import { closeEvmWindowMsg, openEvmWindowMsg, qorechainRegistry } from "@qorechain/sdk";

export const CHAIN_ID = "qorechain-diana";
const registry = qorechainRegistry();

export const qorexInstalled = () => !!getQorexNative();
export const qorexCanSend = () => hasCapability(getQorexNative(), "signAndBroadcast");

/** The wallet's native-lane address. QoreX asks the user to connect this site the first time. */
export async function qorexNativeAddress(): Promise<string> {
  const native = getQorexNative();
  if (!native) throw new Error("QoreX isn't installed in this browser.");
  return (await native.getKey(CHAIN_ID)).bech32Address;
}

type Msg = { typeUrl: string; value: unknown };
const encode = (m: Msg) => ({ typeUrl: m.typeUrl, value: registry.encode(m as any) });

async function send(messages: Msg[], memo: string): Promise<QorexSignAndBroadcastResult> {
  const r = await qorexSignAndBroadcast({ chainId: CHAIN_ID, memo, messages: messages.map(encode) });
  if (r.code !== 0) throw new Error(`The chain refused the transaction (code ${r.code}, ${r.txHash}).`);
  return r;
}

/** Close the account's EVM window: its secp256k1 key can no longer spend on the EVM lane. */
export function closeWindow(sender: string) {
  return send([closeEvmWindowMsg(sender)], "Q-Day checkup: close EVM window");
}

/**
 * Replace a wide window with a narrow one: about an hour, one transaction, at most `maxUqor`, and only to `target`
 * when one is given. One hybrid-signed transaction carries both messages.
 */
export function narrowWindow(sender: string, opts: { target?: string; maxUqor: bigint }) {
  return send([
    closeEvmWindowMsg(sender),
    openEvmWindowMsg({ sender, blocks: 720, maxTxs: 1, maxValue: opts.maxUqor.toString(), ...(opts.target ? { allowedTargets: [opts.target] } : {}) }),
  ], "Q-Day checkup: narrow EVM window");
}

/**
 * Record a checkup on chain: a hybrid-signed self-transfer of 1 uqor (plus the network fee) whose memo carries the verdict
 * and the report hash, so anyone can see when this account was last checked and what it showed.
 */
export function signCheckup(sender: string, memo: string) {
  return send([{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: { fromAddress: sender, toAddress: sender, amount: [{ denom: "uqor", amount: "1" }] } }], memo);
}
