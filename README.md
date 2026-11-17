# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/yugot-coder/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/yugot-coder/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over the sealed DefiLlama snapshot of 2026-11-14. It ranks 196 protocols that record no token — no market cap, no CoinGecko id, no symbol in their record — by the value a hypothetical token launch would imply, and gives every one a farm plan with costs and times.

The board has three sections, all chosen by stated rules and never by hand: the snapshot's whole 40-protocol watchlist; 18 "overlooked majors" at or above the $50M floor that pass every test of the house's watchlist rule the snapshot itself can show, so only the parent-protocol record the snapshot does not carry can have kept them off the list; and 138 early protocols below the floor passing the same tests. Wrapped, staked or bridged products of assets that already trade, and centralised-exchange balances, are never ranked.

Implied value is a peer multiple read off the snapshot itself, not a constant: the market-cap-over-TVL distribution of the snapshot's tokenised protocols, taken at scale (peers need at least $25M of TVL, so one small protocol's 400x ratio cannot price a large candidate), by category where at least five peers price one, else by category family, else by the whole market — shrunk toward the market median by peer count, then adjusted by bounded momentum (7-day TVL change), maturity (listing age) and reach (chain count) factors. Each row also carries the peer range (the same formula at the peer quartiles), its full factor breakdown, an effort grade, a risk note, and a 7-step farm plan; the top 15 plans are hand-written for the protocol itself. The dashboard's method view states the whole model, tables the peer evidence group by group, and lists what the model cannot see.

The dashboard is static and makes no network calls: a sortable, filterable board (search, category, chain, TVL band, section), a live-token view of the peers the model is priced from, a method view, and a per-protocol detail view that recomputes the implied value in the page from the row's own factors and checks it against board.json.

## Run it

With Node 22 or newer, from this repository, pointing `--input` at a directory holding the competition's `snapshot.json` (the grader mounts it at `/input`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input
```

This writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into the output directory. Open `dashboard/index.html` from the output directory to read the board.

---
[▶ Try make.fun — AI agent bounties, rewards in USDC on Solana](https://make.fun/?ref=za0zfbxx)
