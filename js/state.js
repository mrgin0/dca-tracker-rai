// ============================================================
//  SHARED STATE + CONSTANTS
// ============================================================

export const DEFAULT_ASSETS = [
  { symbol: 'QQQM', name: 'QQQM (Nasdaq 100 ETF)', unit: 'unit', yahoo: 'QQQM', isDefault: true },
  { symbol: 'VWRA', name: 'VWRA (Vanguard FTSE All-World)', unit: 'unit', yahoo: 'VWRA.L', isDefault: true },
  { symbol: 'BTC', name: 'Bitcoin (BTC)', unit: 'BTC', yahoo: 'BTC-USD', isDefault: true },
];

const ASSET_COLORS = { QQQM: '#3E5C82', VWRA: '#3F6E5A', BTC: '#A8853F' };
const CUSTOM_COLORS = ['#7C3AED', '#B4436A', '#0E7C86', '#5B4B8A', '#8A5A2B', '#2F6E63', '#4457A6', '#8A6D1C', '#455565', '#6B3FA0'];

export const state = {
  assets: [...DEFAULT_ASSETS],
  currentTab: restoreActiveAsset(),
  editId: null,
  data: {},
  user: null,
  branding: null,
  tableRowsPerPage: {}, // symbol -> 10 | 50 | 100 | 'ALL' (default 10)
  tableSortDir: {},     // symbol -> 'asc' | 'desc' (default 'desc' = terbaru dulu)
  chartRange: 'ALL',
  charts: { line: null, pie: null },
};

export function initData() {
  const next = {};
  state.assets.forEach((a) => (next[a.symbol] = []));
  state.data = next;
}

export function assetOf(symbol) {
  return state.assets.find((a) => a.symbol === symbol) || state.assets[0];
}

export function colorForAsset(symbol) {
  if (ASSET_COLORS[symbol]) return ASSET_COLORS[symbol];
  const custom = state.assets.filter((a) => !ASSET_COLORS[a.symbol]).map((a) => a.symbol);
  const idx = Math.max(0, custom.indexOf(symbol));
  return CUSTOM_COLORS[idx % CUSTOM_COLORS.length];
}

export function canDeleteInstrument(asset) {
  return !!asset && asset.isDefault !== true && !DEFAULT_ASSETS.some((d) => d.symbol === asset.symbol);
}

export function storageKey(name) { return `meridian-${name}`; }

export function restoreActiveAsset() {
  try { return localStorage.getItem(storageKey('active-asset')) || 'QQQM'; }
  catch { return 'QQQM'; }
}
export function saveActiveAsset() {
  try { localStorage.setItem(storageKey('active-asset'), state.currentTab); } catch {}
}
