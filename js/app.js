// ============================================================
//  APP — entry point: login gate, wiring, event delegation
// ============================================================

import { state, initData, DEFAULT_ASSETS, assetOf } from './state.js?v=9';
import { initTheme, applyTheme, showAlert, showConfirm, openBackdrop, closeBackdrop, fileToLogoDataURL, formatDateTimeWITA } from './utils.js?v=9';
import { signIn, signOut, resetPassword, onAuth } from './auth.js?v=9';
import { auth } from './firebase-config.js?v=9';
import {
  fetchAssets, createAsset, deleteAsset,
  fetchTransactions, createTransaction, updateTransaction, deleteTransaction,
  getBranding, saveBranding,
  getLastPriceSnapshot, saveLastPriceSnapshot,
} from './store.js?v=9';
import { fetchMarketPrices, savePriceInput } from './prices.js?v=9';
import { renderAll, renderTabContent, setLoading } from './ui.js?v=9';
import { renderCharts, setChartRange, resetChartZoom } from './charts.js?v=9';
import { exportXLSX, exportBackupJSON } from './export.js?v=9';
import { DEFAULT_BRANDING, getCachedBranding, setCachedBranding, applyBranding } from './branding.js?v=9';

const $ = (id) => document.getElementById(id);

// ---------- LOGIN GATE ----------
function setAuthedUI(authed) {
  $('login-view').hidden = authed;
  $('app-view').hidden = !authed;
  document.body.classList.toggle('logged-out', !authed);
  document.body.classList.toggle('logged-in', !!authed);
}

function showLoginError(msg) {
  const el = $('login-error');
  if (!el) return;
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.textContent = msg;
  el.hidden = false;
}

/** Fallback: sinkronkan state.user dari auth.currentUser kalau onAuth callback belum terpanggil. */
function ensureUser() {
  if (!state.user && auth?.currentUser) {
    state.user = auth.currentUser;
    console.info('[meridian] state.user disinkronkan dari auth.currentUser', state.user.uid);
  }
  return state.user;
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
    $('price-hint').textContent = describeDataError(e);
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
    showErrorBanner(describeDataError(e));
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

function applyPriceSnapshot(snapshot) {
  if (!snapshot || !snapshot.prices) return;
  Object.entries(snapshot.prices).forEach(([symbol, price]) => {
    const el = document.getElementById('price-' + symbol.replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (el && (price !== null && price !== undefined)) {
      el.value = price;
      savePriceInput(symbol, String(price));
    }
  });
  const hint = $('price-hint');
  if (hint && snapshot.fetchedAt) {
    hint.textContent = `Harga diperbarui: ${formatDateTimeWITA(snapshot.fetchedAt)}`;
  }
}

async function loadLastPriceSnapshot() {
  if (!state.user) return;
  try {
    const snapshot = await getLastPriceSnapshot(state.user.uid);
    if (snapshot) applyPriceSnapshot(snapshot);
  } catch (e) { console.warn('price snapshot load:', e.message); }
}

// ---------- AUTH ERROR MESSAGES ----------
const AUTH_ERROR_MESSAGES = {
  'auth/user-not-found': 'Email ini belum terdaftar di Firebase. Buat user di Firebase Console → Authentication → Users → Add user.',
  'auth/wrong-password': 'Password salah. Periksa kembali kata sandi Anda.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/invalid-credential': 'Email atau password salah. Pastikan cocok persis dengan yang terdaftar di Firebase (huruf besar/kecil berpengaruh).',
  'auth/user-disabled': 'Akun ini telah dinonaktifkan di Firebase Console.',
  'auth/too-many-requests': 'Terlalu banyak percobaan login gagal. Coba lagi dalam beberapa menit.',
  'auth/network-request-failed': 'Koneksi gagal. Periksa internet Anda.',
  'auth/api-key-not-valid': 'Firebase API key tidak valid. Cek js/firebase-config.js.',
  'auth/configuration-not-found': 'Sign-in method Email/Password belum diaktifkan di Firebase Console → Authentication → Sign-in method.',
};

function describeAuthError(e) {
  return AUTH_ERROR_MESSAGES[e.code] || e.message || 'Gagal masuk. Coba lagi.';
}

function describeDataError(e) {
  const msg = e?.message || String(e || '');
  if (/blocked|Failed to fetch|network|ERR_BLOCKED/i.test(msg)) {
    return 'Gagal terhubung ke database — kemungkinan diblokir ad-blocker/ekstensi privasi browser. Coba nonaktifkan ekstensi tersebut untuk situs ini (atau buka di jendela Incognito) lalu coba lagi.';
  }
  if (/permission|insufficient/i.test(msg)) {
    return 'Akses ditolak oleh Firestore. Cek Security Rules di Firebase Console sudah di-Publish (rules_version = "2" + match /users/{uid}/{document=**}).';
  }
  return msg || 'Terjadi kesalahan. Coba lagi.';
}

// ---------- AUTH HANDLERS ----------
async function handleSignIn() {
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  showLoginError('');
  if (!email || !password) return showLoginError('Isi email dan kata sandi dulu.');
  try {
    const cred = await signIn(email, password);
    $('auth-password').value = '';
    // Set state.user segera — tidak menunggu onAuth callback yang kadang telat.
    if (cred?.user) {
      state.user = cred.user;
      console.info('[meridian] state.user diset dari signIn credential', cred.user.uid);
    }
  } catch (e) {
    console.error('Login error:', e.code, e.message);
    showLoginError(describeAuthError(e));
  }
}

async function handleForgot() {
  const email = $('auth-email').value.trim();
  showLoginError('');
  if (!email) return showLoginError('Isi email dulu, lalu klik "Lupa password?" untuk kirim tautan reset.');
  try {
    await resetPassword(email);
    showAlert(`Tautan reset password sudah dikirim ke ${email} lewat Firebase. Cek inbox (atau folder spam).`, 'Cek email Anda');
  } catch (e) {
    showLoginError(describeAuthError(e));
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
  if (!ensureUser()) return showAlert('Sesi login belum aktif. Coba refresh halaman lalu login ulang.', 'Belum login');
  const symbol = $('asset-symbol').value.trim().toUpperCase();
  const name = $('asset-name').value.trim();
  const unit = $('asset-unit').value.trim() || 'unit';
  const yahoo = $('asset-yahoo').value.trim();
  if (!symbol) return showAlert('Kode aset wajib diisi.');
  if (state.assets.some((a) => a.symbol === symbol)) return showAlert('Aset sudah ada.');
  try {
    await createAsset(state.user.uid, { symbol, name: name || symbol, unit, yahoo });
  } catch (e) {
    console.error('createAsset failed:', e);
    return showAlert(describeDataError(e), 'Gagal menyimpan instrumen');
  }
  closeBackdrop('instrument-modal-backdrop');
  await loadAll();
  state.currentTab = symbol;
  renderAll();
}

async function handleRemoveAsset(symbol) {
  if (!ensureUser()) return showAlert('Sesi login belum aktif. Coba refresh halaman lalu login ulang.', 'Belum login');
  if (DEFAULT_ASSETS.some((a) => a.symbol === symbol)) return showAlert('Aset default tidak bisa dihapus.');
  const trxCount = (state.data[symbol] || []).length;
  if (trxCount > 0) return showAlert(`Instrumen ${symbol} masih punya ${trxCount} transaksi. Hapus transaksinya dulu.`);
  const ok = await showConfirm(`Yakin hapus instrumen ${symbol}?\n\nInstrumen hilang dari daftar aset.`, 'Hapus instrumen?', 'danger');
  if (!ok) return;
  const a = assetOf(symbol);
  if (a.id) {
    try { await deleteAsset(state.user.uid, a.id); }
    catch (e) { return showAlert(describeDataError(e), 'Gagal menghapus instrumen'); }
  }
  await loadAll();
}

// ---------- TRANSACTION HANDLERS ----------
async function handleSaveEntry(asset) {
  if (!ensureUser()) return showAlert('Sesi login belum aktif. Coba refresh halaman lalu login ulang.', 'Belum login');
  const tanggal = $('f-tanggal').value;
  const hargaBeli = parseFloat($('f-harga').value);
  const jumlahUnit = parseFloat($('f-unit').value);
  const totalBeli = parseFloat($('f-total').value);
  if (!tanggal || isNaN(hargaBeli) || isNaN(jumlahUnit) || isNaN(totalBeli)) return showAlert('Lengkapi semua field dulu.');

  try {
    if (state.editId !== null) {
      await updateTransaction(state.user.uid, state.editId, { tanggal, hargaBeli, jumlahUnit, totalBeli });
      state.editId = null;
    } else {
      await createTransaction(state.user.uid, { asset, tanggal, hargaBeli, jumlahUnit, totalBeli });
    }
  } catch (e) {
    console.error('save transaction failed:', e);
    return showAlert(describeDataError(e), 'Gagal menyimpan transaksi');
  }
  await reloadTransactions();
  renderAll();
}

async function handleDelEntry(asset, id) {
  if (!ensureUser()) return showAlert('Sesi login belum aktif. Coba refresh halaman lalu login ulang.', 'Belum login');
  const ok = await showConfirm('Hapus transaksi ini?', 'Hapus transaksi?', 'danger');
  if (!ok) return;
  try { await deleteTransaction(state.user.uid, id); }
  catch (e) { return showAlert(describeDataError(e), 'Gagal menghapus transaksi'); }
  if (state.editId === id) state.editId = null;
  await reloadTransactions();
  renderAll();
}

function startEdit(asset, id) {
  state.currentTab = asset;
  state.editId = id;
  renderAll();
  document.querySelector('#tab-content .panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- PRICES ----------
async function handleFetchPrices() {
  const hint = $('price-hint');
  try {
    hint.textContent = 'Mengambil harga realtime…';
    const { filled, prices, at } = await fetchMarketPrices();
    if (filled) {
      hint.textContent = `Harga diperbarui: ${formatDateTimeWITA(at)}`;
      if (ensureUser()) {
        try {
          await saveLastPriceSnapshot(state.user.uid, { prices, fetchedAt: at });
        } catch (e) {
          console.warn('gagal simpan snapshot harga:', e.message);
        }
      }
    } else {
      hint.textContent = 'Tidak ada harga valid dari ticker yang dipakai.';
    }
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
  if (ensureUser()) {
    try { await saveBranding(state.user.uid, branding); }
    catch (e) { showAlert('Tampilan diterapkan, tapi gagal menyimpan ke akun: ' + describeDataError(e)); }
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
  $('theme-btn').addEventListener('click', () => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
    setTimeout(renderCharts, 40);
  });

  $('signin-btn').addEventListener('click', handleSignIn);
  $('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSignIn(); });
  $('auth-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('auth-password').focus(); });
  $('forgot-btn').addEventListener('click', handleForgot);
  $('logout-btn').addEventListener('click', handleSignOut);

  $('setting-btn').addEventListener('click', openSettingsModal);
  $('settings-cancel').addEventListener('click', () => closeBackdrop('settings-modal-backdrop'));
  $('settings-save').addEventListener('click', handleSettingsSave);
  $('settings-logo-file').addEventListener('change', handleLogoFile);
  $('settings-logo-reset').addEventListener('click', () => { pendingLogo = ''; renderSettingsPreview(); });
  $('set-title').addEventListener('input', () => { if (!pendingLogo) renderSettingsPreview(); });

  $('instrument-cancel').addEventListener('click', () => closeBackdrop('instrument-modal-backdrop'));
  $('instrument-save').addEventListener('click', handleAddAsset);

  $('fetch-prices-btn').addEventListener('click', handleFetchPrices);
  $('export-btn').addEventListener('click', exportXLSX);
  $('backup-json-btn').addEventListener('click', exportBackupJSON);

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, symbol, id, range } = el.dataset;
    switch (action) {
      case 'switch-tab':
        console.info('[meridian] switch-tab ->', symbol);
        state.currentTab = symbol; state.editId = null; renderAll();
        break;
      case 'open-instrument': openInstrumentModal(); break;
      case 'save-entry': handleSaveEntry(symbol); break;
      case 'edit-entry': startEdit(symbol, id); break;
      case 'del-entry': handleDelEntry(symbol, id); break;
      case 'cancel-edit': state.editId = null; renderTabContent(); break;
      case 'remove-asset': handleRemoveAsset(symbol); break;
      case 'toggle-sort':
        state.tableSortDir[symbol] = (state.tableSortDir[symbol] || 'desc') === 'desc' ? 'asc' : 'desc';
        renderTabContent();
        break;
      case 'set-page-size':
        state.tableRowsPerPage[symbol] = el.dataset.size === 'ALL' ? 'ALL' : Number(el.dataset.size);
        renderTabContent();
        break;
      case 'set-chart-range': setChartRange(range); break;
      case 'reset-zoom': resetChartZoom(); break;
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'f-harga' || t.id === 'f-unit') autoCalc();
    else if (t.id === 'f-total') autoCalcFromTotal();
    else if (t.dataset.price) { savePriceInput(t.dataset.price, t.value); renderTabContent(); }
  });
}

// ---------- GLOBAL ERROR BANNER ----------
function showErrorBanner(message) {
  let banner = document.getElementById('global-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'global-error-banner';
    banner.className = 'error-banner';
    document.body.prepend(banner);
  }
  banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${message}</span> <button type="button" aria-label="Tutup">&times;</button>`;
  banner.querySelector('button').addEventListener('click', () => banner.remove());
}

window.addEventListener('error', (e) => {
  console.error('Uncaught error:', e.error || e.message);
  showErrorBanner(`Terjadi error: ${e.message || 'lihat Console (F12) untuk detail.'}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const msg = reason?.message || String(reason);
  console.error('Unhandled promise rejection:', reason);
  if (/blocked|network|fetch|Failed to fetch/i.test(msg)) {
    showErrorBanner('Koneksi ke server diblokir. Coba nonaktifkan ad-blocker/ekstensi privasi untuk situs ini, lalu refresh.');
  } else {
    showErrorBanner(`Terjadi error: ${msg}`);
  }
});

// ---------- BOOT ----------
async function handleUserChange(user) {
  state.user = user || null;
  state.assets = [...DEFAULT_ASSETS];
  state.data = {};
  setAuthedUI(!!user);
  if (user) {
    showLoginError('');
    console.info('[meridian] onAuth -> user:', user.uid);
    await loadBranding();
    await loadAll();
    await loadLastPriceSnapshot();
  } else {
    console.info('[meridian] onAuth -> signed out');
    initData();
    renderAll();
  }
}

function boot() {
  try {
    initTheme();
    applyBranding(getCachedBranding());
    initData();
    wireEvents();
    renderAll();
    setAuthedUI(false);

    // Kalau session sudah restored oleh Firebase, langsung pakai user-nya.
    if (auth?.currentUser) {
      console.info('[meridian] auth.currentUser tersedia saat boot');
      handleUserChange(auth.currentUser);
    }

    onAuth(handleUserChange);
  } catch (e) {
    console.error('Boot gagal:', e);
    showErrorBanner(`Aplikasi gagal dimuat: ${e.message}. Coba hard refresh (Ctrl+Shift+R) atau cek ekstensi browser.`);
  }
}

boot();
