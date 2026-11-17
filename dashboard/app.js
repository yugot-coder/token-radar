// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts from the
// same board that becomes board.json) and renders three views: the ranked board, the live-token
// protocols the peer model is priced from, and the method. A detail drawer per protocol shows
// the valuation's own arithmetic, recomputed in the page, and the farm plan board.json carries.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('app');
  var drawer = document.getElementById('drawer');
  if (!DATA || !app) return;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtUsdFull(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + ' y';
    return Math.max(0, Math.round(days)) + ' d';
  }
  function fmtMult(x) { return '×' + x.toFixed(3); }
  function fmtFactor(x) { return '×' + x.toFixed(4); }

  var SECTIONS = {
    watchlist: { label: 'Watchlist', hint: 'on the snapshot\u2019s own watchlist' },
    majors: { label: 'Overlooked major', hint: 'at or above the floor, kept off the list only by a test the snapshot cannot show' },
    early: { label: 'Early radar', hint: 'below the floor, passing the same tests' }
  };
  var SRC = { category: 'category peers', family: 'family peers', market: 'market' };

  var bySlug = {};
  DATA.rows.forEach(function (r) { bySlug[r.slug] = r; });
  var groupByLabel = {};
  DATA.peer_groups.forEach(function (g) { groupByLabel[g.label] = g; });
  var usedLabels = {};
  DATA.rows.forEach(function (r) { usedLabels[r.model.multiple_label] = true; });

  // State lives in the hash, so a link (or a screenshot) can name an exact view.
  var state = { tab: 'board', q: '', category: 'all', chain: 'all', band: 'all', section: 'all', sort: 'rank', dir: 1, p: null };
  function readHash() {
    var h = new URLSearchParams(location.hash.replace(/^#/, ''));
    ['tab', 'q', 'category', 'chain', 'band', 'section', 'sort'].forEach(function (k) {
      if (h.get(k)) state[k] = h.get(k);
    });
    if (h.get('dir')) state.dir = h.get('dir') === '-1' ? -1 : 1;
    state.p = h.get('p');
  }
  function writeHash() {
    var h = new URLSearchParams();
    if (state.tab !== 'board') h.set('tab', state.tab);
    if (state.q) h.set('q', state.q);
    if (state.category !== 'all') h.set('category', state.category);
    if (state.chain !== 'all') h.set('chain', state.chain);
    if (state.band !== 'all') h.set('band', state.band);
    if (state.section !== 'all') h.set('section', state.section);
    if (state.sort !== 'rank') { h.set('sort', state.sort); h.set('dir', String(state.dir)); }
    if (state.p) h.set('p', state.p);
    var s = h.toString();
    history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
  }

  var categories = [];
  var catSeen = {};
  var chains = [];
  var chainSeen = {};
  DATA.rows.forEach(function (r) {
    if (r.category && !catSeen[r.category]) { catSeen[r.category] = 1; categories.push(r.category); }
    r.chains.forEach(function (c) { if (!chainSeen[c]) { chainSeen[c] = 1; chains.push(c); } });
  });
  categories.sort(); chains.sort();

  var BANDS = [
    ['all', 'Any TVL'], ['1b', 'TVL ≥ $1B'], ['250m', '$250M – $1B'], ['50m', '$50M – $250M'], ['under', 'TVL < $50M']
  ];
  function inBand(tvl, band) {
    if (band === '1b') return tvl >= 1e9;
    if (band === '250m') return tvl >= 2.5e8 && tvl < 1e9;
    if (band === '50m') return tvl >= 5e7 && tvl < 2.5e8;
    if (band === 'under') return tvl < 5e7;
    return true;
  }

  function headerHtml() {
    return '<header class="top"><div class="brand"><h1><span class="mark">◉</span> Token Radar</h1>' +
      '<span class="ver">model ' + esc(DATA.model_version) + '</span></div>' +
      '<p class="lede">Every protocol in the ' + esc(DATA.as_of) + ' snapshot that <strong>records no token</strong> — no market cap, ' +
      'no CoinGecko id, no symbol — ranked by the value a token launch would imply, priced from the snapshot\u2019s own tokenised peers. ' +
      'The whole ' + DATA.watchlist_size + '-protocol watchlist is covered, plus the majors the house rule\u2019s visible tests cannot have excluded ' +
      'and the early protocols below its floor. Open any row for the full arithmetic and a farm plan with costs and times.</p>' +
      '<div class="stats">' +
      stat(DATA.universe_size, 'protocols in the snapshot') +
      stat(DATA.pre_token_size, 'record no token') +
      stat(DATA.board_size, 'rows on this board') +
      stat(DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'watchlist covered') +
      stat(fmtUsd(DATA.board_tvl_usd), 'TVL across the board') +
      stat(fmtUsd(DATA.median_implied_usd), 'median implied value') +
      '</div>' +
      '<nav class="tabs" role="tablist">' +
      tabBtn('board', 'The board') + tabBtn('live', 'Live tokens (the peers)') + tabBtn('method', 'Method &amp; caveats') +
      '</nav></header>';
    function stat(v, k) { return '<div class="stat"><div class="v">' + esc(v) + '</div><div class="k">' + esc(k) + '</div></div>'; }
    function tabBtn(id, label) {
      return '<button role="tab" data-tab="' + id + '" aria-selected="' + (state.tab === id) + '">' + label + '</button>';
    }
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.section !== 'all' && r.section !== state.section) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (!inBand(r.tvl_usd, state.band)) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var key = {
      rank: function (r) { return r.rank; },
      tvl: function (r) { return r.tvl_usd; },
      change: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
      age: function (r) { return r.age_days === null ? -1 : r.age_days; },
      multiple: function (r) { return r.model.multiple; },
      implied: function (r) { return r.implied_value_usd; }
    }[state.sort] || function (r) { return r.rank; };
    rows.sort(function (a, b) {
      var d = (key(a) - key(b)) * state.dir;
      return d !== 0 ? d : a.rank - b.rank;
    });
    return rows;
  }

  function boardHtml() {
    var rows = filteredRows();
    var maxImplied = rows.reduce(function (m, r) { return Math.max(m, r.implied_value_usd); }, 0);
    var catOpts = '<option value="all">All categories</option>' + categories.map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var chainOpts = '<option value="all">All chains</option>' + chains.map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var bandOpts = BANDS.map(function (b) {
      return '<option value="' + b[0] + '"' + (state.band === b[0] ? ' selected' : '') + '>' + b[1] + '</option>';
    }).join('');
    var chips = [['all', 'All sections'], ['watchlist', 'Watchlist'], ['majors', 'Overlooked majors'], ['early', 'Early radar']].map(function (s) {
      return '<button data-section="' + s[0] + '" aria-pressed="' + (state.section === s[0]) + '">' + s[1] + '</button>';
    }).join('');
    function th(key, label, cls) {
      var arrow = state.sort === key ? (state.dir === 1 ? ' ↑' : ' ↓') : '';
      return '<th class="sortable ' + (cls || '') + '" data-sort="' + key + '">' + label + arrow + '</th>';
    }
    var body = rows.map(function (r) {
      var w = maxImplied > 0 ? Math.max(2, Math.round(100 * Math.sqrt(r.implied_value_usd / maxImplied))) : 0;
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="rank">' + r.rank + '</td>' +
        '<td><div class="pname">' + esc(r.name) + '</div><div class="pmeta">' + esc(r.category || 'Uncategorised') + ' · ' +
          esc(r.chains.length ? r.chains[0] + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') : 'chain n/a') + '</div></td>' +
        '<td><span class="tag ' + r.section + '">' + SECTIONS[r.section].label + '</span></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num hide-xs">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num hide-s">' + fmtMult(r.model.multiple) + '<div class="mult-src">' + SRC[r.model.multiple_source] + ' · n=' + r.model.peer_n + '</div></td>' +
        '<td class="num"><strong>' + fmtUsd(r.implied_value_usd) + '</strong><div class="bar"><i style="width:' + w + '%"></i></div></td>' +
        '<td class="num range hide-s">' + fmtUsd(r.range_low_usd) + ' – ' + fmtUsd(r.range_high_usd) + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="controls">' +
      '<input type="search" id="q" placeholder="Search name or category…" value="' + esc(state.q) + '" aria-label="Search">' +
      '<select id="f-category" aria-label="Category">' + catOpts + '</select>' +
      '<select id="f-chain" aria-label="Chain">' + chainOpts + '</select>' +
      '<select id="f-band" aria-label="TVL band">' + bandOpts + '</select>' +
      '<span class="chips">' + chips + '</span>' +
      '<span class="count">' + rows.length + ' of ' + DATA.board_size + ' rows</span></div>' +
      '<div class="panel"><table class="board"><thead><tr>' +
      th('rank', '#') + '<th>Protocol</th><th>Section</th>' + th('tvl', 'TVL', 'num') + th('change', '7d', 'num') +
      th('age', 'Age', 'num hide-xs') + th('multiple', 'Peer ×', 'num hide-s') + th('implied', 'Implied value', 'num') +
      '<th class="num hide-s">Peer range</th>' +
      '</tr></thead><tbody>' + (body || '') + '</tbody></table>' +
      (rows.length === 0 ? '<div class="empty">No protocol matches these filters. Loosen one and the board fills again.</div>' : '') +
      '</div>' +
      '<p class="caveat">Implied value is this entry\u2019s model output, not a price, a forecast or a promise that any protocol will launch a token. ' +
      '“Records no token” describes the snapshot record of ' + esc(DATA.as_of) + '; a protocol may have launched since, or run a points programme the snapshot cannot see.</p>';
  }

  function liveHtml() {
    var peerFloor = DATA.floor_usd * DATA.model.peer_floor_share;
    var body = DATA.live.map(function (r) {
      var counts = r.tvl_usd >= peerFloor && r.mcap_usd !== null;
      return '<tr><td><div class="pname">' + esc(r.name) + '</div><div class="pmeta">' + esc(r.category || 'Uncategorised') + '</div></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + (r.mcap_usd === null ? '—' : fmtUsd(r.mcap_usd)) + '</td>' +
        '<td class="num">' + (r.ratio === null ? '—' : fmtMult(r.ratio)) + '</td>' +
        '<td class="num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td>' + (counts ? '<span class="tag watchlist">peer at scale</span>' : '<span class="mult-src">below the peer floor — shown, not used</span>') + '</td></tr>';
    }).join('');
    return '<p class="view-head">These protocols <strong>already trade</strong>, so the board never ranks them: it prices them. ' +
      'Their market-cap-over-TVL ratios are the peer evidence every implied value on the board is built from — but only at scale: ' +
      'a peer counts when its TVL clears half the watchlist floor (' + fmtUsd(peerFloor) + '), and each group prices from its <em>median</em>, ' +
      'so the freak ratios at the top of this table (a $7M-TVL record carrying a $2.6B market cap) move nothing. Rows are tagged with which side of that line they fall on. ' +
      'The full peer table, group by group, is in Method &amp; caveats.</p>' +
      '<div class="panel"><table class="plain"><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th>' +
      '<th class="num">Mcap / TVL</th><th class="num">7d</th><th>Peer evidence</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function methodHtml() {
    var m = DATA.model;
    var top = DATA.rows[0];
    var g = groupByLabel[top.model.multiple_label];
    var peerRows = DATA.peer_groups.map(function (gr) {
      var used = usedLabels[gr.label];
      return '<tr' + (used ? ' class="used"' : '') + '><td>' + esc(gr.label) + '</td><td>' + gr.kind + '</td>' +
        '<td class="num">' + gr.n + '</td><td class="num">' + fmtMult(gr.median) + '</td>' +
        '<td class="num">' + fmtMult(gr.p25) + '</td><td class="num">' + fmtMult(gr.p75) + '</td>' +
        '<td>' + (used ? 'prices rows on this board' : '—') + '</td></tr>';
    }).join('');
    return '<div class="method">' +
      '<h2>What this board is</h2>' +
      '<p>A launch radar over one sealed snapshot: DefiLlama\u2019s protocol list of ' + esc(DATA.as_of) + ' (' + DATA.universe_size + ' protocols at $5M of TVL or more). ' +
      'A protocol <em>records no token</em> when its record carries no market cap, no CoinGecko id and no symbol; ' + DATA.pre_token_size + ' of the ' + DATA.universe_size + ' qualify. ' +
      'The board ranks ' + DATA.board_size + ' of them by the value a hypothetical token launch would imply, and gives each a farm plan. ' +
      'Protocols that already trade are never ranked; they are the evidence (Live tokens tab).</p>' +
      '<h2>How the board is chosen — three sections, no hand-picking</h2>' +
      '<ul>' +
      '<li><strong>Watchlist (' + DATA.watchlist_size + ' rows).</strong> Every slug in the snapshot\u2019s own watchlist: protocols at or above the $50M floor that record no token and are not wrapped, staked or bridged products.</li>' +
      '<li><strong>Overlooked majors (' + DATA.majors_size + ' rows).</strong> Pre-token protocols at or above the floor that pass every test of the house\u2019s watchlist rule the snapshot itself can show — category is no product of a traded asset and no exchange, name carries no whole word wrapped, staked or staking, no exchange prefix, no version marker. Only the one test the snapshot does not carry, DefiLlama\u2019s parent-protocol record, can have kept them off the list. Sentora Curator, at $2.76B the joint-largest pre-token protocol in the snapshot, is one of them.</li>' +
      '<li><strong>Early radar (' + DATA.early_size + ' rows).</strong> Pre-token protocols below the $50M floor passing the same visible tests: the early rows a radar exists to find, down to $5M of TVL.</li>' +
      '</ul>' +
      '<p>Never ranked, in any section: a wrapped, staked or bridged product of an asset that already trades (categories Bridge, Canonical Bridge, Cross Chain Bridge, Liquid Staking, Liquid Restaking, Restaked BTC, Stablecoin Wrapper, or a name carrying the whole word wrapped, staked or staking), and a centralised exchange\u2019s balances (category CEX).</p>' +
      '<h2>The valuation model (' + esc(DATA.model_version) + ')</h2>' +
      '<p>Each protocol is valued at a <strong>peer multiple</strong>: the market-cap-over-TVL ratio of the snapshot\u2019s tokenised protocols in its own line of business. ' +
      'A peer only counts at scale — TVL of at least half the watchlist floor ($25M) — because below that a token\u2019s price is set by its float and its story, not by the protocol\u2019s size: without the floor, one prediction market\u2019s 400× ratio (a $7M-TVL record carrying a $2.6B market cap) would price every large candidate. ' +
      'The multiple comes from the protocol\u2019s category where at least ' + m.min_category_peers + ' peers price one, else from its category family, else from the whole market; ' +
      'it is shrunk toward the market median by its peer count (weight n/(n+' + m.shrink_peers + ')) and clamped to [' + m.multiple_min + ', ' + m.multiple_max + ']. ' +
      'Three bounded factors from the protocol\u2019s own record then adjust it. No protocol\u2019s name is special-cased anywhere in the scoring.</p>' +
      '<div class="formula">implied = TVL × peer multiple × momentum × maturity × reach<br>' +
      'momentum = 1 + clamp(7d change, −' + m.momentum_clamp + ', +' + m.momentum_clamp + ') × ' + m.momentum_weight + ' &nbsp;(unreported: ×1)<br>' +
      'maturity = ' + m.maturity_floor + ' + ' + m.maturity_span + ' × min(age, ' + m.maturity_days + ' days) / ' + m.maturity_days + ' &nbsp;(age unknown: ' + m.unknown_age_days + ' days)<br>' +
      'reach &nbsp;&nbsp;&nbsp;= 1 + ' + m.reach_per_chain + ' × min(chains − 1, ' + m.reach_max_extra + ')</div>' +
      '<p>The peer group\u2019s quartiles give each row a <strong>range</strong> beside the point value: the same formula at the shrunk 25th and 75th percentile multiples. ' +
      'The ranges are wide because the peers are: across the market the middle half of tokenised protocols price between ×' +
      (groupByLabel['All tokenised protocols'] ? groupByLabel['All tokenised protocols'].p25.toFixed(3) : '—') + ' and ×' +
      (groupByLabel['All tokenised protocols'] ? groupByLabel['All tokenised protocols'].p75.toFixed(3) : '—') + ' of TVL. A point value without that spread would be false precision.</p>' +
      '<h3>Worked example — the board\u2019s first row</h3>' +
      '<p>' + esc(top.name) + ': TVL ' + fmtUsdFull(top.tvl_usd) + ' × ' + fmtMult(top.model.multiple) + ' (the ' + esc(top.model.multiple_label) + ' family\u2019s median is ' +
      (g ? fmtMult(g.median) : 'n/a') + ' across ' + top.model.peer_n + ' peers at scale, shrunk toward the market) × momentum ' + fmtFactor(top.model.momentum_multiplier) +
      ' × maturity ' + fmtFactor(top.model.maturity_multiplier) + ' × reach ' + fmtFactor(top.model.reach_multiplier) + ' = <strong>' + fmtUsdFull(top.implied_value_usd) + '</strong>, ' +
      'with a peer range of ' + fmtUsdFull(top.range_low_usd) + ' – ' + fmtUsdFull(top.range_high_usd) + '. Open the row to see the same arithmetic checked in the page.</p>' +
      '<h2>The peer evidence</h2>' +
      '<p>Every group the model can price from, from this snapshot alone. Groups in bold price at least one row on this board.</p>' +
      '<div class="panel"><table class="plain"><thead><tr><th>Peer group</th><th>Kind</th><th class="num">Peers</th><th class="num">Median ×</th><th class="num">p25 ×</th><th class="num">p75 ×</th><th>Use</th></tr></thead><tbody>' +
      peerRows + '</tbody></table></div>' +
      '<h2>What the model cannot see — read this before trusting a rank</h2>' +
      '<ul>' +
      '<li><strong>TVL is not revenue.</strong> The snapshot carries no fees, revenue or user counts. Two protocols with equal TVL can earn very differently, and the peer multiple averages over exactly that difference.</li>' +
      '<li><strong>“Records no token” is a statement about a record, not the world.</strong> A protocol may run a points programme, have announced a token, or have launched one after ' + esc(DATA.as_of) + '. The snapshot cannot show any of that, and this board does not pretend to.</li>' +
      '<li><strong>Some records are deployments of others.</strong> The majors section exists because the snapshot lacks DefiLlama\u2019s parent-protocol field; a “major” may in the world be one product of a larger protocol, which is stated on its face rather than hidden.</li>' +
      '<li><strong>Peer prices are one day\u2019s.</strong> Market caps move; the multiples are the snapshot day\u2019s, and a re-run on a later snapshot would move the middle of the board. The head of the board is sturdier: it is set by TVL first and multiples second.</li>' +
      '<li><strong>A farm plan is a hypothesis about activity, not a promise.</strong> No protocol here has announced a token in the snapshot. Plans keep sizes small, never pay to claim anything, and say what each step costs so a reader can price the speculation honestly.</li>' +
      '</ul>' +
      '<div class="note">Data: ' + esc(DATA.source) + '. The snapshot is sealed; this page makes no network calls and shows nothing the snapshot does not carry, beyond the model stated above.</div>' +
      '</div>';
  }

  function openDrawer(slug) {
    var r = bySlug[slug];
    if (!r || !drawer) return;
    state.p = slug;
    writeHash();
    var g = groupByLabel[r.model.multiple_label];
    var recomputed = r.tvl_usd * r.model.multiple * r.model.momentum_multiplier * r.model.maturity_multiplier * r.model.reach_multiplier;
    var drift = Math.abs(recomputed - r.implied_value_usd) / r.implied_value_usd * 100;
    var lo = r.range_low_usd, hi = r.range_high_usd, span = Math.max(hi - lo, 1);
    var fillL = 0, fillW = 100, ptL = Math.min(100, Math.max(0, (r.implied_value_usd - lo) / span * 100));
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    drawer.innerHTML = '<div class="drawer-in">' +
      '<button class="close" data-close>Close ✕</button>' +
      '<h2>' + esc(r.name) + '</h2>' +
      '<div class="sub"><span class="tag ' + r.section + '">' + SECTIONS[r.section].label + '</span><span>' + esc(SECTIONS[r.section].hint) + '</span></div>' +
      '<div class="grid">' +
      cell(fmtUsd(r.tvl_usd), 'TVL') + cell(fmtPct(r.change_7d), 'TVL change, 7d') +
      cell(fmtAge(r.age_days), 'listed for') + cell(r.chains.length + (r.chains.length === 1 ? ' chain' : ' chains'), r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? '…' : '')) +
      '</div>' +
      '<h3>Implied value — the arithmetic</h3>' +
      '<table class="eq">' +
      '<tr><td>Total value locked</td><td class="num">' + fmtUsdFull(r.tvl_usd) + '</td></tr>' +
      '<tr><td>Peer multiple — ' + esc(r.model.multiple_label) + ' (' + SRC[r.model.multiple_source] + ', n=' + r.model.peer_n +
      (g ? '; group median ' + fmtMult(g.median) + ', quartiles ' + fmtMult(g.p25) + '–' + fmtMult(g.p75) : '') + ')</td><td class="num">' + fmtMult(r.model.multiple) + '</td></tr>' +
      '<tr><td>Momentum (7d change ' + fmtPct(r.change_7d) + ')</td><td class="num">' + fmtFactor(r.model.momentum_multiplier) + '</td></tr>' +
      '<tr><td>Maturity (age ' + fmtAge(r.age_days) + ')</td><td class="num">' + fmtFactor(r.model.maturity_multiplier) + '</td></tr>' +
      '<tr><td>Reach (' + r.chains.length + ' chains)</td><td class="num">' + fmtFactor(r.model.reach_multiplier) + '</td></tr>' +
      '<tr class="total"><td>Implied value of a token launch</td><td class="num">' + fmtUsdFull(r.implied_value_usd) + '</td></tr>' +
      '</table>' +
      '<div class="rangebar"><div class="fill" style="left:' + fillL + '%;width:' + fillW + '%"></div><div class="pt" style="left:' + ptL + '%"></div></div>' +
      '<div class="rangelabels"><span>' + fmtUsd(lo) + ' (p25 peers)</span><span>' + fmtUsd(hi) + ' (p75 peers)</span></div>' +
      '<p class="caveat">Checked in this page: TVL × the four rounded factors above recomputes to ' + fmtUsdFull(recomputed) +
      ', within ' + drift.toFixed(2) + '% of the board\u2019s figure, which is computed from unrounded factors. ' +
      'Rank ' + r.rank + ' of ' + DATA.board_size + '. Records no token in the ' + esc(DATA.as_of) + ' snapshot' +
      (r.listed_at ? '; listed ' + esc(r.listed_at) : '; listing date not recorded') + '.</p>' +
      '<h3>Farm plan — ' + r.farm_steps.length + ' steps</h3>' +
      '<ol class="steps">' + steps + '</ol>' +
      '<div class="effortbox"><strong>Effort:</strong> ' + esc(r.effort) + '</div>' +
      '<div class="riskbox"><strong>Risk:</strong> ' + esc(r.risk) + '</div>' +
      '<p class="caveat">A plan is a hypothesis about which activity a launch would count, written from the protocol\u2019s category and chains. ' +
      'Nothing here is financial advice, and no step guarantees an allocation of anything.</p>' +
      '</div>';
    if (!drawer.open) drawer.showModal();
    function cell(v, k) { return '<div class="cell"><div class="v">' + esc(v) + '</div><div class="k">' + esc(k) + '</div></div>'; }
  }

  function render() {
    var view = state.tab === 'live' ? liveHtml() : state.tab === 'method' ? methodHtml() : boardHtml();
    app.innerHTML = '<div class="wrap">' + headerHtml() + view +
      '<footer>Token Radar · model ' + esc(DATA.model_version) + ' · snapshot ' + esc(DATA.as_of) + ' · source: ' + esc(DATA.source) +
      '<br>Implied values are model outputs over a sealed snapshot, not prices or forecasts. “Records no token” describes the snapshot record only.</footer></div>';
    var q = document.getElementById('q');
    if (q) {
      q.addEventListener('input', function () {
        state.q = q.value;
        writeHash();
        var pos = q.selectionStart;
        render();
        var q2 = document.getElementById('q');
        q2.focus(); q2.setSelectionRange(pos, pos);
      });
    }
  }

  app.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-tab]');
    if (tab) { state.tab = tab.getAttribute('data-tab'); writeHash(); render(); return; }
    var chip = e.target.closest('[data-section]');
    if (chip) { state.section = chip.getAttribute('data-section'); writeHash(); render(); return; }
    var th = e.target.closest('[data-sort]');
    if (th) {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) state.dir = state.dir * -1;
      else { state.sort = k; state.dir = k === 'rank' ? 1 : -1; }
      writeHash(); render(); return;
    }
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDrawer(tr.getAttribute('data-slug'));
  });
  app.addEventListener('change', function (e) {
    if (e.target.id === 'f-category') state.category = e.target.value;
    else if (e.target.id === 'f-chain') state.chain = e.target.value;
    else if (e.target.id === 'f-band') state.band = e.target.value;
    else return;
    writeHash(); render();
  });
  drawer.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]') || e.target === drawer) { drawer.close(); }
  });
  drawer.addEventListener('close', function () { state.p = null; writeHash(); });
  window.addEventListener('hashchange', function () { readHash(); render(); if (state.p) openDrawer(state.p); });

  readHash();
  render();
  if (state.p) openDrawer(state.p);
})();
