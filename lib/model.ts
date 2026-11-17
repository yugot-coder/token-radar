// Token Radar's model, version radar-2: one sealed snapshot in, one ranked board out.
//
// The board has three sections, all chosen by stated rules and never by hand:
//
//   watchlist  every slug in the snapshot's own watchlist (the floor, never the ceiling);
//   majors     pre-token protocols at or above the watchlist floor that pass every test of the
//              house's watchlist rule the snapshot itself can show (category, name, exchange
//              prefix), so only the one test the snapshot does not carry, DefiLlama's parent
//              protocol record, can have kept them off the list;
//   early      pre-token protocols below the floor that pass the same visible tests: the early
//              rows a radar exists to find.
//
// A protocol is pre-token when its record carries no token: no market cap, no CoinGecko id and
// no symbol. The board never ranks a wrapped, staked or bridged product of an asset that
// already trades (the product categories Bridge, Canonical Bridge, Cross Chain Bridge, Liquid
// Staking, Liquid Restaking, Restaked BTC and Stablecoin Wrapper, a name carrying the whole
// word wrapped, staked or staking, or a name beginning with an exchange's), nor a centralised
// exchange's balances (category CEX). Everything is phrased as what the record shows: a
// protocol records no token, never that it has none.
//
// Implied value is a peer multiple read off the snapshot itself, not a constant:
// the snapshot's tokenised protocols give, for each category, a distribution of market cap
// over TVL. A peer only counts at scale, with a TVL of at least half the watchlist floor:
// below that a token's price is set by its float and its story, not by the protocol's size,
// and one $7M protocol's 400x ratio would otherwise price every large candidate. A protocol
// is valued at its category's median multiple where at least five tokenised peers price one,
// else at its category family's median, else at the whole market's median; the chosen median
// is shrunk toward the market median by its peer count and clamped, then adjusted by three
// bounded factors read from the protocol's own record:
//
//   implied = tvl_usd x multiple x momentum x maturity x reach
//   momentum = 1 + clamp(change_7d, -30, +30) x 0.005        (unreported: 1)
//   maturity = 0.75 + 0.25 x min(age_days, 1460) / 1460      (age unknown: 365 days)
//   reach    = 1 + 0.02 x min(chains - 1, 5)
//
// The peer distribution's quartiles give each row a range beside the point value: the same
// formula at the shrunk 25th and 75th percentile multiples. No protocol name is special-cased
// anywhere in the scoring: one function values every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** Which peer group priced a row: its category, its category family, or the whole market. */
export type MultipleSource = 'category' | 'family' | 'market';

/** One peer group's market-cap-over-TVL distribution, from the snapshot's tokenised protocols. */
export interface PeerStats {
  n: number;
  median: number;
  p25: number;
  p75: number;
}

/** The peer evidence: every category, every family, and the market as a whole. */
export interface PeerBook {
  market: PeerStats;
  byCategory: Map<string, PeerStats>;
  byFamily: Map<string, PeerStats>;
}

/** The model's constants, stated in the dashboard's method view. */
export interface ModelConstants {
  shrink_peers: number;
  multiple_min: number;
  multiple_max: number;
  range_min: number;
  range_max: number;
  momentum_clamp: number;
  momentum_weight: number;
  maturity_floor: number;
  maturity_span: number;
  maturity_days: number;
  unknown_age_days: number;
  reach_per_chain: number;
  reach_max_extra: number;
  min_category_peers: number;
  min_family_peers: number;
  peer_floor_share: number;
}

export const MODEL: ModelConstants = {
  shrink_peers: 6,
  multiple_min: 0.02,
  multiple_max: 1.25,
  range_min: 0.005,
  range_max: 2.5,
  momentum_clamp: 30,
  momentum_weight: 0.005,
  maturity_floor: 0.75,
  maturity_span: 0.25,
  maturity_days: 1460,
  unknown_age_days: 365,
  reach_per_chain: 0.02,
  reach_max_extra: 5,
  min_category_peers: 5,
  min_family_peers: 5,
  peer_floor_share: 0.5,
};

/** The model's version label: the dashboard names it and the board's rows carry it. */
export const MODEL_VERSION = 'radar-2';

/** The three sections of the board, in the order the dashboard presents them. */
export type BoardSection = 'watchlist' | 'majors' | 'early';

/**
 * The category families: categories whose tokenised protocols price alike. A category with
 * too few priced peers is valued with its family; the family is a stated grouping of the
 * snapshot's own category names, applied to peers and candidates alike.
 */
export const CATEGORY_FAMILY: Record<string, string> = {
  'Risk Curators': 'Vaults & yield',
  'Onchain Capital Allocator': 'Vaults & yield',
  Yield: 'Vaults & yield',
  'Yield Aggregator': 'Vaults & yield',
  'Liquidity Manager': 'Vaults & yield',
  'Leveraged Farming': 'Vaults & yield',
  Farm: 'Vaults & yield',
  Lending: 'Lending & credit',
  CDP: 'Lending & credit',
  'CDP Manager': 'Lending & credit',
  'Uncollateralized Lending': 'Lending & credit',
  'Collateral Markets': 'Lending & credit',
  'Collateral Management': 'Lending & credit',
  Dexs: 'Trading',
  Derivatives: 'Trading',
  Options: 'Trading',
  'Interest Rate Derivatives': 'Trading',
  'Prediction Market': 'Trading',
  Launchpad: 'Trading',
  'OTC Marketplace': 'Trading',
  'NFT Marketplace': 'Trading',
  'Liquid Staking': 'Staking',
  'Liquid Restaking': 'Staking',
  Restaking: 'Staking',
  'Staking Pool': 'Staking',
  'Restaked BTC': 'Staking',
  'Anchor BTC': 'Staking',
  'Decentralized BTC': 'Staking',
  Bridge: 'Bridges',
  'Canonical Bridge': 'Bridges',
  'Cross Chain Bridge': 'Bridges',
  'Basis Trading': 'Stablecoins & basis',
  'Stablecoin Issuer': 'Stablecoins & basis',
  'Algo-Stables': 'Stablecoins & basis',
  'Dual-Token Stablecoin': 'Stablecoins & basis',
  'Stablecoin Wrapper': 'Stablecoins & basis',
  'Reserve Currency': 'Stablecoins & basis',
  Synthetics: 'Stablecoins & basis',
  RWA: 'Real-world assets',
};

/** The family a category belongs to; a category in no family sits in the Unclassified bucket. */
export function familyOf(category: string | null): string {
  if (category === null) return 'Unclassified';
  return CATEGORY_FAMILY[category] ?? 'Unclassified';
}

/** Categories that are a product of an asset that already trades, or an exchange's balances. */
export const PRODUCT_CATEGORIES: ReadonlySet<string> = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Stablecoin Wrapper',
  'CEX',
]);

/** DefiLlama's version-marker rule: a name ending in a release is a deployment of another. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying the whole word wrapped, staked or staking, in any case. */
const PRODUCT_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a pre-token protocol passes every watchlist test the snapshot can show: its
 * category is no product of a traded asset and no exchange, its name carries no product
 * word, no exchange prefix and no version marker. Only DefiLlama's parent record, which
 * the snapshot does not carry, can keep such a protocol off the house's list.
 */
export function passesVisibleTests(p: SnapshotProtocol): boolean {
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (PRODUCT_WORD.test(p.name) || EXCHANGE_PREFIX.test(p.name) || VERSIONED.test(p.name)) return false;
  return true;
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The q-th percentile of an ascending array, by linear interpolation between closest ranks. */
function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** A peer group's distribution from its members' market-cap-over-TVL ratios. */
function peerStats(ratios: number[]): PeerStats {
  const sorted = [...ratios].sort((a, b) => a - b);
  return { n: sorted.length, median: percentile(sorted, 0.5), p25: percentile(sorted, 0.25), p75: percentile(sorted, 0.75) };
}

/**
 * The peer evidence of one snapshot: the market-cap-over-TVL distribution of every protocol
 * that records a token with a market cap and clears the peer scale floor (half the watchlist
 * floor), grouped by category and by family. Protocols that record a token but no market
 * cap, or none at scale, price nothing here and are left out, as the method view states.
 */
export function buildPeerBook(snapshot: Snapshot, model: ModelConstants = MODEL): PeerBook {
  const peerFloor = snapshot.floor_usd * model.peer_floor_share;
  const byCategory = new Map<string, number[]>();
  const byFamily = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd < peerFloor) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    if (p.category !== null) {
      const list = byCategory.get(p.category) ?? [];
      list.push(ratio);
      byCategory.set(p.category, list);
    }
    const fam = familyOf(p.category);
    const flist = byFamily.get(fam) ?? [];
    flist.push(ratio);
    byFamily.set(fam, flist);
  }
  const catStats = new Map<string, PeerStats>();
  for (const [k, v] of byCategory) catStats.set(k, peerStats(v));
  const famStats = new Map<string, PeerStats>();
  for (const [k, v] of byFamily) famStats.set(k, peerStats(v));
  return { market: peerStats(all), byCategory: catStats, byFamily: famStats };
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The chosen peer group for one protocol: the first with enough priced peers. */
export function peerGroupFor(p: SnapshotProtocol, book: PeerBook, model: ModelConstants = MODEL): { source: MultipleSource; label: string; stats: PeerStats } {
  if (p.category !== null) {
    const cat = book.byCategory.get(p.category);
    if (cat !== undefined && cat.n >= model.min_category_peers) return { source: 'category', label: p.category, stats: cat };
    const fam = book.byFamily.get(familyOf(p.category));
    if (fam !== undefined && fam.n >= model.min_family_peers) return { source: 'family', label: familyOf(p.category), stats: fam };
  }
  return { source: 'market', label: 'All tokenised protocols', stats: book.market };
}

/** A peer figure shrunk toward the market's by the group's size, then clamped to its band. */
function shrunk(value: number, marketValue: number, n: number, model: ModelConstants, lo: number, hi: number): number {
  const w = n / (n + model.shrink_peers);
  return clamp(w * value + (1 - w) * marketValue, lo, hi);
}

/** One protocol's full valuation under the model: every factor the dashboard shows. */
export interface Valuation {
  implied: number;
  range_low: number;
  range_high: number;
  multiple: number;
  multiple_low: number;
  multiple_high: number;
  multiple_source: MultipleSource;
  multiple_label: string;
  peer_n: number;
  momentum: number;
  maturity: number;
  reach: number;
  age: number | null;
}

/** Value one protocol from the peer book and its own record. The only scoring function. */
export function impliedValue(p: SnapshotProtocol, asOf: string, book: PeerBook, model: ModelConstants = MODEL): Valuation {
  const group = peerGroupFor(p, book, model);
  const st = group.stats;
  const multiple = shrunk(st.median, book.market.median, st.n, model, model.multiple_min, model.multiple_max);
  let multiple_low = shrunk(st.p25, book.market.p25, st.n, model, model.range_min, model.range_max);
  let multiple_high = shrunk(st.p75, book.market.p75, st.n, model, model.range_min, model.range_max);
  if (multiple_low > multiple) multiple_low = multiple;
  if (multiple_high < multiple) multiple_high = multiple;
  const growth = clamp(finite(p.change_7d, 0), -model.momentum_clamp, model.momentum_clamp);
  const momentum = p.change_7d === null ? 1 : 1 + growth * model.momentum_weight;
  const age = ageDays(asOf, p.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const maturity = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_span;
  const reach = 1 + model.reach_per_chain * Math.min(Math.max(p.chains.length - 1, 0), model.reach_max_extra);
  const adj = momentum * maturity * reach;
  return {
    implied: Math.max(1, Math.round(p.tvl_usd * multiple * adj)),
    range_low: Math.max(1, Math.round(p.tvl_usd * multiple_low * adj)),
    range_high: Math.max(1, Math.round(p.tvl_usd * multiple_high * adj)),
    multiple: round4(multiple),
    multiple_low: round4(multiple_low),
    multiple_high: round4(multiple_high),
    multiple_source: group.source,
    multiple_label: group.label,
    peer_n: st.n,
    momentum: round4(momentum),
    maturity: round4(maturity),
    reach: round4(reach),
    age,
  };
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  section: BoardSection;
  age_days: number | null;
  implied_value_usd: number;
  range_low_usd: number;
  range_high_usd: number;
  model: {
    version: string;
    multiple: number;
    multiple_low: number;
    multiple_high: number;
    multiple_source: MultipleSource;
    multiple_label: string;
    peer_n: number;
    momentum_multiplier: number;
    maturity_multiplier: number;
    reach_multiplier: number;
    age_days: number | null;
  };
  effort: string;
  risk: string;
  farm_steps: string[];
}

/** The dashboard's view of one row: the board row's figures and its farm plan, whole. */
export interface RadarRow extends BoardRow {}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  ratio: number | null;
}

/** One peer group as the method view tables it. */
export interface PeerGroupRow {
  label: string;
  kind: MultipleSource | 'family';
  n: number;
  median: number;
  p25: number;
  p75: number;
}

/** Everything the dashboard needs: the board, the live set, the peer evidence and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  universe_size: number;
  pre_token_size: number;
  watchlist_size: number;
  board_size: number;
  majors_size: number;
  early_size: number;
  live_size: number;
  board_tvl_usd: number;
  median_implied_usd: number;
  peer_groups: PeerGroupRow[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const book = buildPeerBook(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, { p: SnapshotProtocol; section: BoardSection }>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, { p, section: 'watchlist' });
  }
  const rest = snapshot.protocols.filter((p) => !watch.has(p.slug) && isPreToken(p) && passesVisibleTests(p));
  for (const p of rest) {
    chosen.set(p.slug, { p, section: p.tvl_usd >= snapshot.floor_usd ? 'majors' : 'early' });
  }
  const scored = [...chosen.values()].map(({ p, section }) => ({ p, section, v: impliedValue(p, snapshot.as_of, book, model) }));
  scored.sort((a, b) => b.v.implied - a.v.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    section: s.section,
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    range_low_usd: s.v.range_low,
    range_high_usd: s.v.range_high,
    model: {
      version: MODEL_VERSION,
      multiple: s.v.multiple,
      multiple_low: s.v.multiple_low,
      multiple_high: s.v.multiple_high,
      multiple_source: s.v.multiple_source,
      multiple_label: s.v.multiple_label,
      peer_n: s.v.peer_n,
      momentum_multiplier: s.v.momentum,
      maturity_multiplier: s.v.maturity,
      reach_multiplier: s.v.reach,
      age_days: s.v.age,
    },
    effort: effortFor(s.p),
    risk: riskFor(s.p),
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Whether a chain settles cheaply: the layer-2 and sidechain names a farmer pays cents on. */
const CHEAP_CHAIN = /^(Base|Arbitrum|Optimism|Polygon|Solana|Monad|Ink|Sonic|Linea|Scroll|Mantle|Berachain|Plasma|Katana|Unichain|Stellar|Algorand|Sui|Near|Aptos|BOB|Hemi|TAC|Flare|Sei|MegaETH|Abstract|zkSync Era|Blast|Mode|Taiko|World Chain)$/;

/** The gas a first position costs on a protocol's main chain, from the chain's own fee level. */
function gasNote(chain: string): string {
  if (CHEAP_CHAIN.test(chain)) return 'under $1 of gas on ' + chain;
  if (chain === 'Ethereum') return 'about $5 to $15 of gas on Ethereum at quiet times';
  if (chain === 'Bitcoin') return 'about $1 to $5 of network fees on Bitcoin';
  if (chain === 'Tron') return 'about $1 of energy and bandwidth fees on Tron';
  if (chain === 'Binance') return 'under $1 of gas on BNB Chain';
  return 'a few dollars of gas on ' + chain;
}

/** The category's core action and its second action, in words a farmer can follow. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): [string, string] {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('liquidity manager'))
    return [
      `Deposit $${capital} of USDC into a ${name} vault on ${chain}: pick its largest stablecoin vault, the one holding most of its TVL.`,
      `After a week, move half the position into a second ${name} vault on the same chain, so two of its vaults record your wallet.`,
    ];
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return [
      `Supply $${capital} of USDC to ${name} on ${chain}, then borrow about 30% of it against the position and supply the borrowed amount again.`,
      `Repay and re-borrow once a month so the borrow side of ${name} records continuing activity, and never let the health factor fall below 1.6.`,
    ];
  if (c.includes('dex'))
    return [
      `Provide $${capital} of liquidity to ${name}'s deepest stablecoin or native-asset pool on ${chain} and keep the LP position open.`,
      `Route one swap a week through ${name} itself rather than an aggregator, so the exchange records your wallet as a trader too.`,
    ];
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('option'))
    return [
      `Deposit $${capital} of USDC as margin on ${name} and open one small position, hedged with an equal spot holding elsewhere.`,
      `Trade one small contract a week on ${name} and keep the margin account funded between trades.`,
    ];
  if (c.includes('prediction'))
    return [
      `Fund $${capital} and take one position in ${name}'s most liquid market, sized so a total loss is acceptable.`,
      `Take a position in a second market each week, and settle or roll the first one before it expires.`,
    ];
  if (c.includes('restak') || c.includes('staking'))
    return [
      `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet.`,
      `Restake or delegate the receipt once through ${name}'s own second step, where it offers one, and leave both positions untouched.`,
    ];
  if (c.includes('rwa'))
    return [
      `Mint $${capital} of ${name}'s yield asset on ${chain} after its onboarding check, and hold the asset in the farming wallet.`,
      `Hold through one full distribution or interest period of ${name}, so the holding spans a payment date.`,
    ];
  if (c.includes('basis') || c.includes('stable') || c.includes('synthetic'))
    return [
      `Mint or deposit $${capital} of ${name}'s stable asset on ${chain} and hold it, or stake it in ${name}'s own staking contract where one is offered.`,
      `Provide $${capital / 2} of liquidity for the stable asset in ${name}'s main pool, so both the holder and the liquidity records name your wallet.`,
    ];
  if (c.includes('yield'))
    return [
      `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and keep the vault shares in the farming wallet.`,
      `Claim and re-deposit the vault's yield once a month rather than withdrawing it, so the position compounds on record.`,
    ];
  if (c.includes('insurance'))
    return [
      `Buy $${capital} of cover from ${name} on ${chain} for a position you actually hold, and keep the policy to its term.`,
      `Stake a smaller amount into ${name}'s underwriting pool only if you accept its loss terms, and read them first.`,
    ];
  if (c.includes('chain') || c.includes('payment'))
    return [
      `Bridge $${capital} of USDC to ${chain} and hold it in a wallet on ${name}'s own network, then make one payment or transfer a week from it.`,
      `Use one native application on ${chain} each week (a swap or a deposit), so the wallet reads as a resident, not a passer-by.`,
    ];
  if (c.includes('privacy'))
    return [
      `Deposit $${capital} through ${name} on ${chain} using its standard privacy flow, and keep the note or receipt it issues.`,
      `Make one withdrawal to a fresh address of your own after the holding period, completing the full cycle ${name} records.`,
    ];
  return [
    `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    `Add a second, smaller position in ${name}'s other main product on ${chain} after the first week.`,
  ];
}

/** The weekly qualifying action, by category: what to repeat so the activity keeps counting. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('dex') || c.includes('derivative') || c.includes('prediction')) return `Make one small trade on ${name} each week, at a size you would trade anyway.`;
  if (c.includes('lend') || c.includes('cdp')) return `Adjust the position on ${name} once a week: supply or repay a small amount, so no week passes without a transaction.`;
  if (c.includes('bridge') || c.includes('chain')) return `Move a small amount through ${name} once a week, in either direction.`;
  return `Make one qualifying action on ${name} each week: a deposit, a claim, a vote or a small top-up of the position.`;
}

/** The plan's effort grade: what running this farm asks of a reader, from its shape. */
export function effortFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('prediction') || c.includes('leveraged')) return 'High: weekly trades and a margin balance to watch';
  if (c.includes('lend') || c.includes('cdp') || c.includes('dex')) return 'Medium: a weekly touch and a health check';
  if (p.chains.length >= 8) return 'Medium: one main position, many chains to ignore';
  return 'Low: deposit, hold, and a monthly check';
}

/** The plan's risk note: the loss a farmer actually carries, by category. */
export function riskFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp')) return `${name} is a credit market: the position can be liquidated if its health factor falls, and its contracts carry smart-contract risk.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `${name} takes margin: an unhedged position can lose the whole deposit, and funding rates add a running cost.`;
  if (c.includes('prediction')) return `${name} settles positions to zero or one: a wrong position loses its whole stake, so sizes stay small.`;
  if (c.includes('rwa')) return `${name} holds off-chain assets: the yield depends on an issuer off chain, and redemption can be slower than an on-chain exit.`;
  if (c.includes('restak') || c.includes('staking')) return `${name} stakes assets: slashing and an unbonding queue can delay or reduce the exit, on top of contract risk.`;
  if (c.includes('bridge')) return `${name} moves assets between chains: bridge contracts are a standing target, so amounts stay small and exits are tested early.`;
  if (c.includes('dex')) return `${name} holds pool positions: impermanent loss and a thin pool can cost more than the gas saved, on top of contract risk.`;
  if (c.includes('basis') || c.includes('stable')) return `${name} holds a stable asset: a depeg or a failed hedge can cut the position's value, on top of contract risk.`;
  return `${name} holds funds in its contracts: smart-contract risk is the main exposure, and no step here removes it.`;
}

/**
 * Hand-written plans for the board's head: the protocols a reader opens first get steps that
 * name their own product, not the category template. Keyed by slug; the generic generator
 * below covers every other row, and a plan here follows the same shape (action, cost, time).
 */
export const HANDCRAFTED: Record<string, FarmStep[]> = {
  'steakhouse-financial': [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm Steakhouse Financial with, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: 'Fund the wallet on Base, Steakhouse\'s largest chain of the 11 it runs on in this snapshot, with USDC for the position plus a little ETH for gas.', cost: 'under $1 of gas on Base', time: '10 minutes' },
    { text: 'Deposit $250 of USDC into Steakhouse\'s flagship USDC vault on Morpho on Base (its steakUSDC vault) and keep the vault shares in the farming wallet.', cost: '$250 of capital in the position', time: '15 minutes to set up' },
    { text: 'After a week, put a second, smaller deposit into Steakhouse\'s USDC vault on Morpho on Ethereum, so two of its curated vaults on two chains record your wallet.', cost: 'a further $100 of capital, plus Ethereum gas at a quiet time', time: '10 minutes' },
    { text: 'Once a week, open the vault\'s page on Morpho and read its allocation note: if Steakhouse moves the vault\'s markets or caps, note the date in your log.', cost: 'no transaction needed to check', time: '10 minutes a week' },
    { text: 'Hold both vault positions for at least 30 days, so the activity is counted in more than one snapshot of Steakhouse Financial.', cost: 'the $350 stays in the vaults', time: '30 days' },
    { text: 'Before withdrawing, check Steakhouse\'s own site and Morpho\'s rewards page for anything owed to the wallet, claim only from links they publish, then log the wallet, the dates and every transaction.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
  ],
  'sentora-curator': [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm Sentora Curator with, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: 'Fund the wallet on Ethereum, Sentora\'s main chain, with USDC for the position plus ETH for gas.', cost: 'about $5 to $15 of gas on Ethereum at quiet times', time: '10 minutes' },
    { text: 'Deposit $250 of USDC into Sentora\'s largest curated vault on Morpho on Ethereum: Sentora (the team behind IntoTheBlock\'s risk work) sets the vault\'s markets and caps.', cost: '$250 of capital in the position', time: '15 minutes to set up' },
    { text: 'After a week, add a second deposit to a Sentora vault with a different collateral mix, so two of its vaults record your wallet.', cost: 'a further $100 of capital, plus a few dollars of gas', time: '10 minutes' },
    { text: 'Once a week, check the vault\'s utilisation and cap on its Morpho page: a curator vault that sits at its cap is one to top up early, not late.', cost: 'no transaction needed to check', time: '10 minutes a week' },
    { text: 'Hold the positions for at least 30 days so the activity spans more than one snapshot of Sentora Curator.', cost: 'the $350 stays in the vaults', time: '30 days' },
    { text: 'Before withdrawing, check Sentora\'s own site and Morpho\'s rewards page for anything owed to the wallet, then log the wallet, the dates and every transaction so the position can be repeated or unwound.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
  ],
  gauntlet: [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm Gauntlet with, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: 'Fund the wallet on Base, Gauntlet\'s main chain of the 14 it runs on, with USDC for the position plus a little ETH for gas.', cost: 'under $1 of gas on Base', time: '10 minutes' },
    { text: 'Deposit $250 of USDC into a Gauntlet-curated vault on Morpho on Base: Gauntlet\'s models set the vault\'s risk parameters, and its largest USDC vault holds most of its Base TVL.', cost: '$250 of capital in the position', time: '15 minutes to set up' },
    { text: 'After a week, open a second Gauntlet vault position on Ethereum\'s Morpho deployment, so the curator records your wallet on two chains.', cost: 'a further $100 of capital, plus Ethereum gas', time: '10 minutes' },
    { text: 'Once a week, read the vault\'s page for allocation or cap changes and top the Base position up by a small amount, so no week passes without a transaction.', cost: 'about $1 of gas a week on Base', time: '10 minutes a week' },
    { text: 'Hold both positions for at least 30 days, so the activity is counted in more than one snapshot of Gauntlet.', cost: 'the $350 stays in the vaults', time: '30 days' },
    { text: 'Before withdrawing, check Gauntlet\'s own site and Morpho\'s rewards page for anything owed to the wallet, claim only from links they publish, then log the wallet, the dates and every transaction.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
  ],
  veda: [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm Veda with, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: 'Fund the wallet on Ink, Veda\'s largest chain of the 13 it runs on in this snapshot, with USDC for the position plus gas.', cost: 'under $1 of gas on Ink', time: '10 minutes' },
    { text: 'Deposit $250 of USDC into Veda\'s main BoringVault deployment on Ink and keep the vault shares: Veda allocates the vault across lending and liquidity venues from there.', cost: '$250 of capital in the position', time: '15 minutes to set up' },
    { text: 'After a week, add a smaller deposit to Veda\'s BoringVault deployment on Ethereum, so two deployments on two chains record your wallet.', cost: 'a further $100 of capital, plus Ethereum gas at a quiet time', time: '10 minutes' },
    { text: 'Once a week, open Veda\'s app and check the vault\'s reported yield and any points balance it shows for the wallet; screenshot the figure for your log.', cost: 'no transaction needed to check', time: '10 minutes a week' },
    { text: 'Hold the positions for at least 30 days, so the activity is counted in more than one snapshot of Veda.', cost: 'the $350 stays in the vaults', time: '30 days' },
    { text: 'Before withdrawing, test the exit with a small withdrawal first: vault exits can queue, and the queue length is part of what you are logging about Veda.', cost: 'gas on the test withdrawal only', time: '15 minutes' },
  ],
  usdd: [
    { text: 'Use a fresh Tron wallet that holds only the funds you plan to farm USDD with, and keep its seed phrase offline.', cost: 'about $1 of energy and bandwidth fees on Tron', time: '5 minutes' },
    { text: 'Fund the wallet on Tron, USDD\'s main chain of the three it runs on, with TRX for collateral and fees.', cost: 'about $1 of energy and bandwidth fees on Tron', time: '10 minutes' },
    { text: 'Mint USDD on its own site by depositing TRX as collateral at a ratio above 150%, minting about $150 of USDD against it: leave the buffer, Tron collateral moves fast.', cost: '$150 of USDD minted against roughly $250 of TRX', time: '15 minutes to set up' },
    { text: 'Stake the minted USDD into its savings vault (sUSDD) on the same site, so the position earns the protocol\'s own rate while it is counted.', cost: 'the minted USDD, plus a few cents of fees', time: '10 minutes' },
    { text: 'Once a week, check the collateral ratio and top the TRX up if it drifts toward 150%, and supply a small amount of USDD on JustLend so a second venue records the wallet.', cost: 'about $1 of fees a week', time: '10 minutes a week' },
    { text: 'Hold the mint and the stake for at least 30 days, spanning more than one of USDD\'s interest periods.', cost: 'the TRX and USDD stay in the position', time: '30 days' },
    { text: 'Unwind in order: unstake the sUSDD, repay the mint, then withdraw the TRX; log every step, because the full cycle is the activity a launch would most plausibly reward.', cost: 'about $2 of fees to unwind', time: '15 minutes' },
  ],
  'polymarket-international': [
    { text: 'Use a fresh wallet that holds only the funds you plan to trade Polymarket International with, and keep its seed phrase offline.', cost: 'under $1 of gas on Polygon', time: '5 minutes' },
    { text: 'Fund the wallet on Polygon, the only chain this record lists, with USDC for trading plus a little POL for gas.', cost: 'under $1 of gas on Polygon', time: '10 minutes' },
    { text: 'Take a $100 position in the platform\'s most liquid market, the one with the tightest spread, sized so a total loss is acceptable: prediction positions settle to zero or one.', cost: '$100 of capital at risk in the position', time: '15 minutes to set up' },
    { text: 'Take a second position in a market from a different category (sport if the first was politics, or the reverse), so the record shows a trader, not a single bet.', cost: 'a further $50 of capital at risk', time: '10 minutes' },
    { text: 'Trade one small position a week, and settle or roll each position before it expires rather than letting it lapse untraded.', cost: 'about $1 of gas a week on Polygon', time: '15 minutes a week' },
    { text: 'Keep the trading record running for at least 30 days across at least four market categories, which is the shape of an ordinary active account.', cost: 'positions stay small; losses are the real cost', time: '30 days' },
    { text: 'Log every market, size and settlement: if this platform ever rewards users, a dated trading history is the only proof of activity you will have.', cost: 'no fee to log', time: '10 minutes' },
  ],
  upshift: [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm Upshift with, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: 'Fund the wallet on Ethereum, Upshift\'s main chain of the 15 it runs on, with USDC for the position plus ETH for gas.', cost: 'about $5 to $15 of gas on Ethereum at quiet times', time: '10 minutes' },
    { text: 'Deposit $150 of USDC into Upshift\'s flagship USDC vault on Ethereum and keep the vault shares in the farming wallet.', cost: '$150 of capital in the position', time: '15 minutes to set up' },
    { text: 'Open Upshift\'s app and check the points balance it shows for depositors: if the wallet\'s balance is zero a day after depositing, the deposit went to a vault that does not count.', cost: 'no transaction needed to check', time: '5 minutes' },
    { text: 'After a week, add a second position in an Upshift ETH vault, so two of its vaults record your wallet.', cost: 'a further $100 of capital, plus a few dollars of gas', time: '10 minutes' },
    { text: 'Hold both positions for at least 30 days, topping the main vault up by a small amount once a week so no week passes without a transaction.', cost: 'the $250 stays in the vaults', time: '30 days' },
    { text: 'Before withdrawing, check Upshift\'s own points page once more and log the final balance, the wallet, the dates and every transaction.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
  ],
  'bittensor-dtao': [
    { text: 'Set up a Bittensor-compatible wallet (the network\'s own extension wallet) that holds only the funds you plan to stake with, and keep its seed phrase offline.', cost: 'a fraction of a TAO in network fees', time: '10 minutes' },
    { text: 'Acquire TAO and send it to the wallet: the dTAO market this record covers is Bittensor\'s staking exchange layer, and TAO is its staking asset.', cost: 'the exchange\'s spread on the purchase', time: '15 minutes' },
    { text: 'Stake about $150 of TAO into the dTAO market: swap the stake into the alpha of two established subnets through a dTAO interface, rather than one new subnet.', cost: '$150 of TAO staked', time: '20 minutes to set up' },
    { text: 'Leave a smaller part of the stake in the root network, so the wallet holds both root stake and subnet alpha.', cost: 'the TAO already funded', time: '10 minutes' },
    { text: 'Once a week, add a small stake to the better-performing of the two subnets and record each subnet\'s alpha price: dTAO prices move, and the log is the point.', cost: 'a fraction of a TAO in fees a week', time: '15 minutes a week' },
    { text: 'Hold the stakes for at least 60 days: this record is young in the snapshot, and a longer window is what separates a staker from a passer-by.', cost: 'the TAO stays staked', time: '60 days' },
    { text: 'Note the unbonding path before you need it: unstake a small amount once, time it, and log the wallet, the subnets and every transaction.', cost: 'a fraction of a TAO in fees', time: '15 minutes' },
  ],
  'nonce-capital': [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm Nonce Capital with, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: 'Fund the wallet on Ethereum, Nonce\'s main chain of the two it runs on, with USDC for the position plus ETH for gas.', cost: 'about $5 to $15 of gas on Ethereum at quiet times', time: '10 minutes' },
    { text: 'Deposit $150 of USDC into Nonce Capital\'s flagship curated vault on Ethereum and keep the vault shares in the farming wallet.', cost: '$150 of capital in the position', time: '15 minutes to set up' },
    { text: 'After a week, open the same curator\'s vault on its Optimism deployment with a smaller deposit, so both of its chains record your wallet.', cost: 'a further $75 of capital, plus under $1 of gas on Optimism', time: '10 minutes' },
    { text: 'Once a week, check the vault\'s cap and utilisation on its page: Nonce is a young listing in this snapshot, and a young curator\'s caps move as it grows.', cost: 'no transaction needed to check', time: '10 minutes a week' },
    { text: 'Hold the positions for at least 60 days: a protocol listed this recently rewards duration more than size.', cost: 'the $225 stays in the vaults', time: '60 days' },
    { text: 'Before withdrawing, check Nonce\'s own site for a points or rewards page, claim only from a link it publishes, then log the wallet, the dates and every transaction.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
  ],
  onre: [
    { text: 'Use a fresh Solana wallet that holds only the funds you plan to farm OnRe with, and keep its seed phrase offline.', cost: 'under $1 of fees on Solana', time: '5 minutes' },
    { text: 'Fund the wallet on Solana, OnRe\'s only chain in this snapshot, with USDC for the position plus a little SOL for fees.', cost: 'under $1 of fees on Solana', time: '10 minutes' },
    { text: 'Deposit $100 of USDC into OnRe\'s reinsurance pool through its own app: the pool underwrites real treaties, and the deposit earns from premiums rather than emissions.', cost: '$100 of capital in the position', time: '15 minutes to set up' },
    { text: 'Read the pool\'s current treaty period and loss terms before depositing more: reinsurance pays for bearing risk that occasionally arrives all at once.', cost: 'no fee to read', time: '15 minutes' },
    { text: 'Once a month, claim or compound the pool\'s yield inside OnRe\'s app, so the holding spans a full underwriting period on record.', cost: 'under $1 of fees on Solana', time: '10 minutes a month' },
    { text: 'Hold the position for at least 45 days, across at least one full treaty period.', cost: 'the $100 stays in the pool', time: '45 days' },
    { text: 'Test the exit with a small withdrawal before the full one, and log the wallet, the dates and every transaction: redemption timing is part of what you are learning about OnRe.', cost: 'under $1 of fees', time: '10 minutes' },
  ],
  opentrade: [
    { text: 'Complete OpenTrade\'s onboarding once (it runs know-your-customer checks for its real-world-asset pools), with a wallet that holds only the funds you plan to farm with.', cost: 'no fee to onboard', time: '30 minutes once' },
    { text: 'Fund the wallet on Avalanche, OpenTrade\'s main chain of the three it runs on, with USDC for the position plus AVAX for gas.', cost: 'under $1 of gas on Avalanche', time: '10 minutes' },
    { text: 'Deposit $100 of USDC into OpenTrade\'s US Treasury or short-term credit pool on Avalanche and hold the pool token to the term\'s end.', cost: '$100 of capital in the position', time: '15 minutes to set up' },
    { text: 'Note the pool\'s term and redemption window in your log on day one: these pools pay at term, not on demand.', cost: 'no fee to note', time: '5 minutes' },
    { text: 'When the first term ends, roll the position into a second term rather than withdrawing, so the record shows a continuing lender.', cost: 'the $100 stays in the pool', time: '10 minutes at each term end' },
    { text: 'Hold across at least two terms, about 60 days in all, so the activity spans more than one snapshot of OpenTrade.', cost: 'the $100 stays in the pool', time: 'about 60 days' },
    { text: 'Log the onboarding date, each term\'s dates and every transaction: for an RWA pool, the verified-account history is the activity that counts.', cost: 'no fee to log', time: '10 minutes' },
  ],
  'plume-vaults': [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm Plume Vaults with, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: 'Bridge $100 of USDC to Plume Mainnet, where Plume\'s Nest vaults run, keeping a little of the chain\'s gas token for fees.', cost: 'a few dollars of bridge and gas fees', time: '15 minutes' },
    { text: 'Deposit the USDC into a Nest flagship vault on Plume and keep the nest receipt token in the farming wallet: the vault holds the real-world-asset strategies behind it.', cost: '$100 of capital in the position', time: '15 minutes to set up' },
    { text: 'After a week, add a smaller deposit to a second Nest vault with a different strategy, so two vaults record your wallet.', cost: 'a further $50 of capital, plus under $1 of gas', time: '10 minutes' },
    { text: 'Once a week, make one small action on Plume (a top-up or a claim) and check the vault\'s reported yield against the week before.', cost: 'under $1 of gas a week on Plume', time: '10 minutes a week' },
    { text: 'Hold both positions for at least 30 days, so the activity is counted in more than one snapshot of Plume Vaults.', cost: 'the $150 stays in the vaults', time: '30 days' },
    { text: 'Before withdrawing, check Plume\'s own site for anything owed to the wallet, claim only from a link it publishes, then log the wallet, the dates and every transaction.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
  ],
  'cian-yield-layer': [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm CIAN Yield Layer with, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: 'Fund the wallet on Ethereum, CIAN\'s main chain of the seven it runs on, with USDC for the position plus ETH for gas.', cost: 'about $5 to $15 of gas on Ethereum at quiet times', time: '10 minutes' },
    { text: 'Deposit $100 of USDC into CIAN\'s yield layer strategy on Ethereum: the layer routes the deposit across the lending and staking venues it aggregates, and the receipt stays in your wallet.', cost: '$100 of capital in the position', time: '15 minutes to set up' },
    { text: 'Where CIAN offers staking of the receipt token, stake it in the same wallet rather than holding it idle, so both the deposit and the stake are on record.', cost: 'a few dollars of gas', time: '10 minutes' },
    { text: 'Once a week, claim the strategy\'s yield inside CIAN\'s app and re-deposit it, so the position compounds on record instead of sitting still.', cost: 'a few dollars of gas a week on Ethereum, less if you batch monthly', time: '10 minutes a week' },
    { text: 'Hold the position for at least 30 days, so the activity is counted in more than one snapshot of CIAN Yield Layer.', cost: 'the $100 stays in the strategy', time: '30 days' },
    { text: 'Before withdrawing, check CIAN\'s own site for a points or rewards page, claim only from a link it publishes, then log the wallet, the dates and every transaction.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
  ],
  'bitfi-basis': [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm BitFi Basis with, and keep its seed phrase offline.', cost: 'under $1 of gas on BNB Chain', time: '5 minutes' },
    { text: 'Fund the wallet on BNB Chain, BitFi\'s first-listed chain of the seven it runs on, with USDT or a BTC-pegged asset for the position plus BNB for gas.', cost: 'under $1 of gas on BNB Chain', time: '10 minutes' },
    { text: 'Deposit $100 into BitFi\'s basis vault: the strategy holds the spot leg and the hedge leg of a BTC basis trade, and your receipt token represents the pair, not a naked long.', cost: '$100 of capital in the position', time: '15 minutes to set up' },
    { text: 'Read the vault\'s reported funding rate before adding more: a basis strategy earns the funding spread, and a negative week is information, not an error.', cost: 'no fee to read', time: '10 minutes' },
    { text: 'Once a week, check the vault\'s yield and the funding note, and top the position up by a small amount in the weeks the spread is positive.', cost: 'under $1 of gas a week on BNB Chain', time: '10 minutes a week' },
    { text: 'Hold the position for at least 30 days, so the activity spans more than one funding cycle of BitFi Basis.', cost: 'the $100 stays in the vault', time: '30 days' },
    { text: 'Test the exit with a small withdrawal first (basis vaults can settle the hedge leg on a delay), then log the wallet, the dates and every transaction.', cost: 'under $1 of gas for the test', time: '15 minutes' },
  ],
  symbiotic: [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm Symbiotic with, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: 'Fund the wallet on Ethereum, Symbiotic\'s only chain in this snapshot, with wstETH or USDC for the position plus ETH for gas.', cost: 'about $5 to $15 of gas on Ethereum at quiet times', time: '10 minutes' },
    { text: 'Deposit $150 of collateral into a Symbiotic vault on Ethereum: the vault restakes the collateral toward the networks Symbiotic secures, and the deposit starts the wallet\'s points balance on Symbiotic\'s own app.', cost: '$150 of capital in the position', time: '15 minutes to set up' },
    { text: 'After a week, open a second Symbiotic vault with a different collateral, so two vaults record your wallet.', cost: 'a further $100 of capital, plus a few dollars of gas', time: '10 minutes' },
    { text: 'Once a week, open Symbiotic\'s app and record the points balance and each vault\'s cap: capped vaults fill, and a full vault is a reason to have arrived early.', cost: 'no transaction needed to check', time: '10 minutes a week' },
    { text: 'Hold both deposits for at least 30 days, so the activity is counted in more than one snapshot of Symbiotic.', cost: 'the $250 stays in the vaults', time: '30 days' },
    { text: 'Note each vault\'s withdrawal queue before exiting, withdraw a small amount first to time it, then log the wallet, the dates and every transaction.', cost: 'gas on the test withdrawal only', time: '15 minutes' },
  ],
};

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, derived from
 * the protocol's own record (category, chains, TVL, age) unless a hand-written plan above
 * names the protocol itself.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const made = HANDCRAFTED[p.slug];
  if (made !== undefined) return made;
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const [first, second] = actionsFor(p, capital, chain);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm ${p.name} with, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `Fund the wallet on ${chain}, ${p.name}'s main chain${p.chains.length > 1 ? ` of the ${p.chains.length} it runs on` : ''}, with the position's capital plus gas.`,
      cost: gasNote(chain),
      time: '10 minutes',
    },
    { text: first, cost: `$${capital} of capital in the position`, time: '15 minutes to set up' },
    { text: second, cost: 'the position already funded, plus a few dollars of gas', time: '10 minutes' },
    {
      text: weeklyFor(p),
      cost: 'about $2 of gas a week, less on a layer-2 chain',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot of ${p.name}.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before withdrawing, open ${p.name}'s own points or rewards page and claim only from the link it publishes; then log the wallet, the dates and every transaction so the position can be repeated or unwound.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
  return steps;
}

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 36;

/** The live-token protocols, by market cap, for the dashboard's Live token view and peer table. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** The peer groups the method view tables: the market, each family, and each priced category. */
export function peerGroupRows(book: PeerBook): PeerGroupRow[] {
  const rows: PeerGroupRow[] = [{ label: 'All tokenised protocols', kind: 'market', ...book.market }];
  for (const [label, st] of [...book.byFamily.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    rows.push({ label, kind: 'family', ...st });
  }
  for (const [label, st] of [...book.byCategory.entries()].sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1))) {
    rows.push({ label, kind: 'category', ...st });
  }
  return rows;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const book = buildPeerBook(snapshot, model);
  const live = liveRows(snapshot);
  const impliedSorted = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    universe_size: snapshot.protocols.length,
    pre_token_size: snapshot.protocols.filter(isPreToken).length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    majors_size: board.filter((r) => r.section === 'majors').length,
    early_size: board.filter((r) => r.section === 'early').length,
    live_size: live.length,
    board_tvl_usd: board.reduce((n, r) => n + r.tvl_usd, 0),
    median_implied_usd: impliedSorted.length > 0 ? impliedSorted[Math.floor(impliedSorted.length / 2)]! : 0,
    peer_groups: peerGroupRows(book),
    rows: board,
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, ranges, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100 the gate asks`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (r.range_low_usd > r.implied_value_usd || r.range_high_usd < r.implied_value_usd) return `${r.slug} has a range that misses its implied value`;
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
