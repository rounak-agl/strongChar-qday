# How AI is used to build the Q-Day checkup

Built by Rounak with an AI coding agent (Claude Code, Anthropic), with the same workflow as
[strongChar](https://github.com/rounak-agl/strongChar/blob/main/AI_USAGE.md): Rounak decides, the agent measures the
chain before relying on it, writes code and tests, and anything outward-facing waits for Rounak.

| Date | What the agent did | What Rounak did |
|---|---|---|
| 21 Nov | Read the Quantum Pass rules and the `create-qorechain-dapp` templates; scaffolded from viem-wagmi | Asked to start the side entry |
| 22 Nov | Measured on diana which transactions are signed classically (500 recent sends, 50 key registrations) before writing any claim; wrote the checkup, the QoreX fixes, stubbed verdict cases and QoreX test-double checks | Reviews and approves publishing |

## Where AI was not trusted blindly

- The claim that an unregistered account's classical key can register a post-quantum key first is from live chain
  data, not documentation.
- Verdict rules are pinned by `scripts/check-cases.ts`; a first draft rated every account that had ever transacted
  as at risk forever, which the cases caught and the rule was corrected.
