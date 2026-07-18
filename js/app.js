// ============================================================
//  APP — entry point: wiring, auth flow, event delegation
// ============================================================

import { state, initData, DEFAULT_ASSETS, assetOf } from './state.js';
import { initTheme, applyTheme, showAlert, showConfirm } from './utils.js';
import { signIn, signOut, onAuth } from './auth.js';
import { fetchAssets, createAsset, deleteAsset, fetchTransactions, createTransaction, updateTransaction, deleteTransaction } from './store.js';
import { fetchMarketPrices, savePriceInput } from './prices.js';
import { renderAll, renderTabContent, setLoading } from './ui.js';
import { renderCharts } from './charts.js';
import { exportXLSX } from './export.js';

const $ = (id) => document.getElementById(id);

// ---------- AUTH UI ----------
function refreshAuthUI() {
  const u = state.user;
  const pill = $('user-pill'), loginBtn = $('show-auth-btn'), logoutBtn = $('logout-btn');
  if (u) {
    pill.textContent = u.email; pill.hidden = false;
    loginBtn.hidden = true; logoutBtn.hidden = false;
    $('auth-panel').hidden = true;
  } else {
    pill.hidden = true; loginBtn.hidden = false; logoutBtn.hidden = true;
  }
}

// ---------- DATA LOAD ----------
async function loadAll() {
  state.assets = [...DEFAULT_ASSETS];
  if (!state.user) { initData(); renderAll(); return; }

  setLoading('Memuat data dari Firebase…');
  try {
    const custom = await fetchAssets(state.user.uid);
    custom.forEach((c) => { if (!state.assets.some((a) => a.symbol === c.symbol)) state.assets.push(c); });
  } catch (e) {
    console.warn('assets load:', e.message);
    $('price-hint').textContent = 'Gagal memuat instrumen. Cek konfigurasi Firebase / Firestore rules.';
  }
  initData();
  try {
    const txs = await fetchTransactions(state.user.uid);
    txs.forEach((row) => {
      if (!state.data[row.asset]) state.data[row.asset] = [];
      state.data[row.asset].push(row);
    });
  } catch (e) {
    console.warn('tx load:', e.message);
    await showAlert('Gagal memuat transaksi: ' + e.message);
  }
  renderAll();
}

// ---------- HANDLERS ----------
async function handleSignIn() {
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  if (!email || !password) return showAlert('Isi email dan kata sandi dulu.');
  try {
    await signIn(email, password);
    $('auth-password').value = '';
  } catch (e) {
    showAlert(e.message || 'Gagal masuk.', 'Login gagal');
  }
}

async function handleSignOut() {
  await signOut();
}

async function handleAddAsset() {
  if (!state.user) return showAlert('Masuk dulu untuk menambah instrumen.');
  const symbol = $('asset-symbol').value.trim().toUpperCase();
  const name = $('asset-name').value.trim();
  const unit = $('asset-unit').value.trim() || 'unit';
  const yahoo = $('asset-yahoo').value.trim();
  if (!symbol) return showAlert('Kode aset wajib diisi.');
  if (state.assets.some((a) => a.symbol === symbol)) return showAlert('Aset sudah ada.');
  try {
    await createAsset(state.user.uid, { symbol, name: name || symbol, unit, yahoo });
  } catch (e) {
    return showAlert(e.message || 'Gagal menyimpan instrumen.');
  }
  ['asset-symbol', 'asset-name', 'asset-unit', 'asset-yahoo'].forEach((id) => ($(id).value = ''));
  state.showInstrumentForm = false;
  await loadAll();
  state.currentTab = symbol;
  renderAll();
}

async function handleRemoveAsset(symbol) {
  if (DEFAULT_ASSETS.some((a) => a.symbol === symbol)) return showAlert('Aset default tidak bisa dihapus.');
  const trxCount = (state.data[symbol] || []).length;
  if (trxCount > 0) return showAlert(`Instrumen ${symbol} masih punya ${trxCount} transaksi. Hapus transaksinya dulu.`);
  const ok = await showConfirm(`Yakin hapus instrumen ${symbol}?\n\nInstrumen hilang dari daftar aset.`, 'Hapus instrumen?', 'danger');
  if (!ok) return;
  const a = assetOf(symbol);
  if (a.id) {
    try { await deleteAsset(state.user.uid, a.id); }
    catch (e) { return showAlert(e.message); }
  }
  await loadAll();
}

async function handleSaveEntry(asset) {
  if (!state.user) return showAlert('Masuk dulu agar data tersimpan.');
  const tanggal = $('f-tanggal').value;
  const hargaBeli = parseFloat($('f-harga').value);
  const jumlahUnit = parseFloat($('f-unit').value);
  const totalBeli = parseFloat($('f-total').value);
  if (!tanggal || isNaN(hargaBeli) || isNaN(jumlahUnit) || isNaN(totalBeli)) return showAlert('Lengkapi semua field dulu.');

  try {
    if (state.editIdx !== null) {
      const id = state.data[asset][state.editIdx].id;
      await updateTransaction(state.user.uid, id, { tanggal, hargaBeli, jumlahUnit, totalBeli });
      state.editIdx = null;
    } else {
      await createTransaction(state.user.uid, { asset, tanggal, hargaBeli, jumlahUnit, totalBeli });
    }
  } catch (e) {
    return showAlert(e.message);
  }
  await reloadTransactions();
  renderAll();
}

async function handleDelEntry(asset, idx) {
  const ok = await showConfirm('Hapus transaksi ini?', 'Hapus transaksi?', 'danger');
  if (!ok) return;
  const id = state.data[asset][idx].id;
  try { await deleteTransaction(state.user.uid, id); }
  catch (e) { return showAlert(e.message); }
  if (state.editIdx === idx) state.editIdx = null;
  await reloadTransactions();
  renderAll();
}

async function reloadTransactions() {
  if (!state.user) { initData(); return; }
  initData();
  const txs = await fetchTransactions(state.user.uid);
  txs.forEach((row) => {
    if (!state.data[row.asset]) state.data[row.asset] = [];
    state.data[row.asset].push(row);
  });
}

function startEdit(asset, idx) {
  state.currentTab = asset;
  state.editIdx = idx;
  renderAll();
  document.querySelector('#tab-content .panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleFetchPrices() {
  const hint = $('price-hint');
  try {
    hint.textContent = 'Mengambil harga realtime…';
    const { filled } = await fetchMarketPrices();
    hint.textContent = filled
      ? 'Harga realtime dimuat ke input (tidak disimpan sebagai histori).'
      : 'Tidak ada harga valid dari ticker yang dipakai.';
    renderTabContent();
    renderCharts();
  } catch (e) {
    if (e.message === 'NO_TICKERS') { hint.textContent = 'Belum ada aset dengan ticker. Isi harga pasar manual.'; return; }
    hint.textContent = 'Ambil data gagal. Cek endpoint harga atau tunggu jika sedang rate limit.';
    showAlert('Ambil data gagal: ' + (e.message || e));
  }
}

// ---------- AUTO-CALC ----------
function autoCalc() {
  const h = parseFloat($('f-harga')?.value);
  const u = parseFloat($('f-unit')?.value);
  if (!isNaN(h) && !isNaN(u)) $('f-total').value = (h * u).toFixed(2);
}
function autoCalcFromTotal() {
  const h = parseFloat($('f-harga')?.value);
  const t = parseFloat($('f-total')?.value);
  if (!isNaN(h) && h > 0 && !isNaN(t)) $('f-unit').value = (t / h).toFixed(6);
}

// ---------- EVENT DELEGATION ----------
function wireEvents() {
  // Masthead (static elements)
  $('theme-btn').addEventListener('click', () => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
    setTimeout(renderCharts, 40);
  });
  $('show-auth-btn').addEventListener('click', () => { $('auth-panel').hidden = !$('auth-panel').hidden; });
  $('logout-btn').addEventListener('click', handleSignOut);
  $('signin-btn').addEventListener('click', handleSignIn);
  $('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSignIn(); });
  $('fetch-prices-btn').addEventListener('click', handleFetchPrices);
  $('add-asset-btn').addEventListener('click', handleAddAsset);
  $('cancel-instrument-btn').addEventListener('click', () => { state.showInstrumentForm = false; $('instrument-panel').hidden = true; });
  $('export-btn').addEventListener('click', exportXLSX);

  // Delegated clicks (rendered content)
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, symbol, idx } = el.dataset;
    switch (action) {
      case 'switch-tab': state.currentTab = symbol; state.editIdx = null; renderAll(); break;
      case 'toggle-instrument': state.showInstrumentForm = !state.showInstrumentForm; $('instrument-panel').hidden = !state.showInstrumentForm; break;
      case 'save-entry': handleSaveEntry(symbol); break;
      case 'edit-entry': startEdit(symbol, Number(idx)); break;
      case 'del-entry': handleDelEntry(symbol, Number(idx)); break;
      case 'cancel-edit': state.editIdx = null; renderTabContent(); break;
      case 'remove-asset': handleRemoveAsset(symbol); break;
      case 'toggle-rows': state.showAllRows[symbol] = !state.showAllRows[symbol]; renderTabContent(); break;
    }
  });

  // Delegated inputs
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'f-harga' || t.id === 'f-unit') autoCalc();
    else if (t.id === 'f-total') autoCalcFromTotal();
    else if (t.dataset.price) { savePriceInput(t.dataset.price, t.value); renderTabContent(); }
  });
}

// ---------- BOOT ----------
function boot() {
  initTheme();
  initData();
  wireEvents();
  renderAll();

  onAuth(async (user) => {
    state.user = user || null;
    state.assets = [...DEFAULT_ASSETS];
    state.data = {};
    refreshAuthUI();
    await loadAll();
  });
}

boot();
