// ============================================================
//  APP — entry point: login gate, wiring, event delegation
// ============================================================

import { state, initData, DEFAULT_ASSETS, assetOf } from './state.js';
import { initTheme, applyTheme, showAlert, showConfirm, openBackdrop, closeBackdrop, fileToLogoDataURL } from './utils.js';
import { signIn, signOut, resetPassword, onAuth } from './auth.js';
import {
  fetchAssets, createAsset, deleteAsset,
  fetchTransactions, createTransaction, updateTransaction, deleteTransaction,
  getBranding, saveBranding,
} from './store.js';
import { fetchMarketPrices, savePriceInput } from './prices.js';
import { renderAll, renderTabContent, setLoading } from './ui.js';
import { renderCharts } from './charts.js';
import { exportXLSX } from './export.js';
import { DEFAULT_BRANDING, getCachedBranding, setCachedBranding, applyBranding } from './branding.js';

const $ = (id) => document.getElementById(id);

// ---------- LOGIN GATE ----------
function setAuthedUI(authed) {
  $('login-view').hidden = authed;
  $('app-view').hidden = !authed;
  $('setting-btn').hidden = !authed;
  $('logout-btn').hidden = !authed;
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

async function reloadTransactions() {
  if (!state.user) { initData(); return; }
  initData();
  const txs = await fetchTransactions(state.user.uid);
  txs.forEach((row) => {
    if (!state.data[row.asset]) state.data[row.asset] = [];
    state.data[row.asset].push(row);
  });
}

async function loadBranding() {
  if (!state.user) return;
  try {
    const b = await getBranding(state.user.uid);
    if (b) {
      const merged = { ...DEFAULT_BRANDING, ...b };
      setCachedBranding(merged);
      applyBranding(merged);
    }
  } catch (e) { console.warn('branding load:', e.message); }
}

// ---------- AUTH HANDLERS ----------
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

async function handleForgot() {
  const email = $('auth-email').value.trim();
  if (!email) return showAlert('Isi email dulu, lalu klik "Lupa password?" untuk kirim tautan reset.', 'Reset password');
  try {
    await resetPassword(email);
    showAlert(`Tautan reset password sudah dikirim ke ${email} lewat Firebase. Cek inbox (atau folder spam).`, 'Cek email Anda');
  } catch (e) {
    showAlert(e.message || 'Gagal mengirim tautan reset.', 'Reset gagal');
  }
}

async function handleSignOut() { await signOut(); }

// ---------- INSTRUMENT MODAL ----------
function openInstrumentModal() {
  ['asset-symbol', 'asset-name', 'asset-unit', 'asset-yahoo'].forEach((id) => ($(id).value = ''));
  openBackdrop('instrument-modal-backdrop');
  setTimeout(() => $('asset-symbol').focus(), 60);
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
  closeBackdrop('instrument-modal-backdrop');
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

// ---------- TRANSACTION HANDLERS ----------
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

function startEdit(asset, idx) {
  state.currentTab = asset;
  state.editIdx = idx;
  renderAll();
  document.querySelector('#tab-content .panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- PRICES ----------
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

// ---------- SETTINGS MODAL ----------
let pendingLogo = '';

function renderSettingsPreview() {
  const el = $('settings-logo-preview');
  if (pendingLogo) {
    el.innerHTML = `<img src="${pendingLogo}" alt="Logo" />`;
  } else {
    const t = ($('set-title').value || 'M').trim().charAt(0).toUpperCase() || 'M';
    el.innerHTML = `<span data-monogram>${t}</span>`;
  }
}

function openSettingsModal() {
  const b = state.branding || getCachedBranding();
  $('set-title').value = b.title;
  $('set-subtitle').value = b.subtitle;
  $('set-eyebrow').value = b.eyebrow;
  $('set-pagetitle').value = b.pageTitle;
  $('set-lede').value = b.lede;
  pendingLogo = b.logo || '';
  renderSettingsPreview();
  openBackdrop('settings-modal-backdrop');
}

async function handleLogoFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    pendingLogo = await fileToLogoDataURL(file, 160);
    renderSettingsPreview();
  } catch (err) {
    showAlert(err.message || 'Gagal memproses gambar.');
  } finally {
    e.target.value = '';
  }
}

async function handleSettingsSave() {
  const branding = {
    title: $('set-title').value.trim() || DEFAULT_BRANDING.title,
    subtitle: $('set-subtitle').value.trim() || DEFAULT_BRANDING.subtitle,
    eyebrow: $('set-eyebrow').value.trim() || DEFAULT_BRANDING.eyebrow,
    pageTitle: $('set-pagetitle').value.trim() || DEFAULT_BRANDING.pageTitle,
    lede: $('set-lede').value.trim() || DEFAULT_BRANDING.lede,
    logo: pendingLogo || '',
  };
  setCachedBranding(branding);
  applyBranding(branding);
  closeBackdrop('settings-modal-backdrop');
  if (state.user) {
    try { await saveBranding(state.user.uid, branding); }
    catch (e) { showAlert('Tampilan diterapkan, tapi gagal menyimpan ke akun: ' + e.message); }
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

// ---------- EVENT WIRING ----------
function wireEvents() {
  // theme
  $('theme-btn').addEventListener('click', () => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
    setTimeout(renderCharts, 40);
  });

  // auth / login
  $('signin-btn').addEventListener('click', handleSignIn);
  $('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSignIn(); });
  $('forgot-btn').addEventListener('click', handleForgot);
  $('logout-btn').addEventListener('click', handleSignOut);

  // settings modal
  $('setting-btn').addEventListener('click', openSettingsModal);
  $('settings-cancel').addEventListener('click', () => closeBackdrop('settings-modal-backdrop'));
  $('settings-save').addEventListener('click', handleSettingsSave);
  $('settings-logo-file').addEventListener('change', handleLogoFile);
  $('settings-logo-reset').addEventListener('click', () => { pendingLogo = ''; renderSettingsPreview(); });
  $('set-title').addEventListener('input', () => { if (!pendingLogo) renderSettingsPreview(); });

  // instrument modal
  $('instrument-cancel').addEventListener('click', () => closeBackdrop('instrument-modal-backdrop'));
  $('instrument-save').addEventListener('click', handleAddAsset);

  // prices + export
  $('fetch-prices-btn').addEventListener('click', handleFetchPrices);
  $('export-btn').addEventListener('click', exportXLSX);

  // delegated clicks (rendered content)
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, symbol, idx } = el.dataset;
    switch (action) {
      case 'switch-tab': state.currentTab = symbol; state.editIdx = null; renderAll(); break;
      case 'open-instrument': openInstrumentModal(); break;
      case 'save-entry': handleSaveEntry(symbol); break;
      case 'edit-entry': startEdit(symbol, Number(idx)); break;
      case 'del-entry': handleDelEntry(symbol, Number(idx)); break;
      case 'cancel-edit': state.editIdx = null; renderTabContent(); break;
      case 'remove-asset': handleRemoveAsset(symbol); break;
      case 'toggle-rows': state.showAllRows[symbol] = !state.showAllRows[symbol]; renderTabContent(); break;
    }
  });

  // delegated inputs
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
  applyBranding(getCachedBranding()); // instant, from cache
  initData();
  wireEvents();
  renderAll();

  onAuth(async (user) => {
    state.user = user || null;
    state.assets = [...DEFAULT_ASSETS];
    state.data = {};
    setAuthedUI(!!user);
    if (user) {
      await loadBranding();
      await loadAll();
    }
  });
}

boot();
