// ============================================================
//  APP — entry point: login gate, wiring, event delegation
// ============================================================

import { state, initData, DEFAULT_ASSETS, assetOf, entriesOf } from './state.js?v=10';
import { initTheme, applyTheme, showAlert, showConfirm, openBackdrop, closeBackdrop, fileToLogoDataURL, formatDateTimeWITA, fmt, fmtPct } from './utils.js?v=10';
import { signIn, signOut, resetPassword, onAuth } from './auth.js?v=10';
import { auth } from './firebase-config.js?v=10';
import {
  fetchAssets, createAsset, deleteAsset,
  fetchTransactions, createTransaction, updateTransaction, deleteTransaction,
  getBranding, saveBranding,
  getLastPriceSnapshot, saveLastPriceSnapshot,
} from './store.js?v=10';
import { fetchMarketPrices, savePriceInput, applyPrice, getPrice } from './prices.js?v=10';
import { renderAll, renderTabContent, setLoading } from './ui.js?v=10';
import { renderCharts, setChartRange, resetChartZoom } from './charts.js?v=10';
import { exportXLSX, exportBackupJSON } from './export.js?v=10';
import { DEFAULT_BRANDING, getCachedBranding, setCachedBranding, applyBranding } from './branding.js?v=10';

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
// Token pengaman: kalau ada permintaan load baru (mis. onAuth terpanggil dua
// kali), hasil load lama dibuang. Tanpa ini dua load bisa saling menimpa dan
// transaksi terhitung dobel.
let loadToken = 0;

/** Ambil semua transaksi user ke state.data, bebas duplikat. */
async function fillTransactions(token) {
  const txs = await fetchTransactions(state.user.uid);
  if (token !== loadToken) return false;
  initData();
  const seen = new Set();
  txs.forEach((row) => {
    if (!row || !row.asset || seen.has(row.id)) return;
    seen.add(row.id);
    if (!Array.isArray(state.data[row.asset])) state.data[row.asset] = [];
    state.data[row.asset].push(row);
  });
  return true;
}

async function loadAll() {
  const token = ++loadToken;
  state.assets = [...DEFAULT_ASSETS];
  if (!state.user) { initData(); renderAll(); return; }

  setLoading('Memuat data dari Firebase…');
  try {
    const custom = await fetchAssets(state.user.uid);
    if (token !== loadToken) return;
    custom.forEach((c) => { if (!state.assets.some((a) => a.symbol === c.symbol)) state.assets.push(c); });
  } catch (e) {
    console.warn('assets load:', e.message);
    $('price-hint').textContent = describeDataError(e);
  }
  initData();
  try {
    if (!(await fillTransactions(token))) return;
  } catch (e) {
    console.warn('tx load:', e.message);
    showErrorBanner(describeDataError(e));
  }
  renderAll();
}

async function reloadTransactions() {
  if (!state.user) { initData(); return; }
  const token = ++loadToken;
  try {
    await fillTransactions(token);
  } catch (e) {
    console.warn('tx reload:', e.message);
    showErrorBanner(describeDataError(e));
  }
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
  if (!snapshot || !snapshot.prices) return false;
  let applied = 0;
  Object.entries(snapshot.prices).forEach(([symbol, price]) => {
    if (applyPrice(symbol, price)) applied++;
  });
  const hint = $('price-hint');
  if (hint && snapshot.fetchedAt) {
    hint.textContent = `Harga diperbarui: ${formatDateTimeWITA(snapshot.fetchedAt)}`;
  }
  return applied > 0;
}

async function loadLastPriceSnapshot() {
  if (!state.user) return;
  try {
    const snapshot = await getLastPriceSnapshot(state.user.uid);
    // BUGFIX: dulu harga ditulis ke input tanpa render ulang, sehingga
    // ringkasan & grafik tetap memakai kondisi "harga kosong".
    if (applyPriceSnapshot(snapshot)) {
      renderTabContent();
      renderCharts();
    }
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
  state.currentTab = symbol;
  await loadAll();
}

async function handleRemoveAsset(symbol) {
  if (!ensureUser()) return showAlert('Sesi login belum aktif. Coba refresh halaman lalu login ulang.', 'Belum login');
  if (DEFAULT_ASSETS.some((a) => a.symbol === symbol)) return showAlert('Aset default tidak bisa dihapus.');
  const trxCount = entriesOf(symbol).length;
  if (trxCount > 0) return showAlert(`Instrumen ${symbol} masih punya ${trxCount} transaksi. Hapus transaksinya dulu.`);
  const ok = await showConfirm(`Yakin hapus instrumen ${symbol}?\n\nInstrumen hilang dari daftar aset.`, 'Hapus instrumen?', 'danger');
  if (!ok) return;
  const a = assetOf(symbol);
  if (a?.id) {
    try { await deleteAsset(state.user.uid, a.id); }
    catch (e) { return showAlert(describeDataError(e), 'Gagal menghapus instrumen'); }
  }
  await loadAll();
}

// ---------- TRANSACTION: ADD ----------
function readEntryFields(prefix) {
  return {
    tanggal: $(`${prefix}-tanggal`).value,
    hargaBeli: parseFloat($(`${prefix}-harga`).value),
    jumlahUnit: parseFloat($(`${prefix}-unit`).value),
    totalBeli: parseFloat($(`${prefix}-total`).value),
  };
}

function validEntry(v) {
  return !!v.tanggal
    && Number.isFinite(v.hargaBeli) && v.hargaBeli > 0
    && Number.isFinite(v.jumlahUnit) && v.jumlahUnit > 0
    && Number.isFinite(v.totalBeli) && v.totalBeli > 0;
}

async function handleSaveEntry(asset) {
  if (!ensureUser()) return showAlert('Sesi login belum aktif. Coba refresh halaman lalu login ulang.', 'Belum login');
  const v = readEntryFields('f');
  if (!validEntry(v)) return showAlert('Lengkapi semua field dengan angka lebih besar dari 0.');
  try {
    await createTransaction(state.user.uid, { asset, ...v });
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
  if (state.editId === id) { state.editId = null; state.editAsset = null; }
  await reloadTransactions();
  renderAll();
}

// ---------- TRANSACTION: EDIT MODAL ----------
/** Cari transaksi berdasarkan id di semua simbol (id selalu dibandingkan sebagai string). */
function findTx(symbol, id) {
  const wanted = String(id);
  const direct = entriesOf(symbol).find((e) => String(e.id) === wanted);
  if (direct) return { symbol, tx: direct };
  for (const sym of Object.keys(state.data || {})) {
    const hit = entriesOf(sym).find((e) => String(e.id) === wanted);
    if (hit) return { symbol: sym, tx: hit };
  }
  return null;
}

function openEditModal(symbol, id) {
  const found = findTx(symbol, id);
  if (!found) {
    return showAlert('Transaksi tidak ditemukan — mungkin sudah berubah. Muat ulang halaman lalu coba lagi.', 'Tidak bisa diubah');
  }
  const { tx } = found;
  const a = assetOf(found.symbol);

  state.editId = String(tx.id);
  state.editAsset = found.symbol;

  $('edit-modal-sub').textContent = `${a?.name || found.symbol} · ubah lalu simpan. Unrealized & % dihitung ulang otomatis.`;
  $('e-tanggal').value = tx.tanggal || '';
  $('e-harga').value = Number.isFinite(Number(tx.hargaBeli)) ? tx.hargaBeli : '';
  $('e-unit').value = Number.isFinite(Number(tx.jumlahUnit)) ? tx.jumlahUnit : '';
  $('e-total').value = Number.isFinite(Number(tx.totalBeli)) ? tx.totalBeli : '';
  $('e-unit-label').textContent = a?.unit || 'unit';
  $('e-harga-label').textContent = `Harga beli / ${a?.unit || 'unit'} ($)`;

  renderEditPreview();
  openBackdrop('edit-modal-backdrop');
  setTimeout(() => $('e-tanggal').focus(), 60);
}

function closeEditModal() {
  state.editId = null;
  state.editAsset = null;
  closeBackdrop('edit-modal-backdrop');
}

/** Hitung ulang panel pratinjau di modal edit (nilai sekarang / unrealized / %). */
function renderEditPreview() {
  const symbol = state.editAsset;
  if (!symbol) return;
  const cp = getPrice(symbol);
  const units = parseFloat($('e-unit').value);
  const total = parseFloat($('e-total').value);
  const nowEl = $('e-now'), gainEl = $('e-gain'), pctEl = $('e-pct');

  if (cp === null || !Number.isFinite(units)) {
    nowEl.textContent = '—';
    gainEl.textContent = '—'; gainEl.className = '';
    pctEl.textContent = cp === null ? 'harga pasar kosong' : '—'; pctEl.className = '';
    return;
  }
  const nilai = units * cp;
  nowEl.textContent = fmt(nilai);
  if (!Number.isFinite(total)) {
    gainEl.textContent = '—'; gainEl.className = '';
    pctEl.textContent = '—'; pctEl.className = '';
    return;
  }
  const gain = nilai - total;
  const pct = total > 0 ? (gain / total) * 100 : null;
  const cls = gain >= 0 ? 'positive' : 'negative';
  gainEl.textContent = fmt(gain); gainEl.className = cls;
  pctEl.textContent = pct !== null ? fmtPct(pct) : '—'; pctEl.className = cls;
}

async function handleEditSave() {
  if (!ensureUser()) return showAlert('Sesi login belum aktif. Coba refresh halaman lalu login ulang.', 'Belum login');
  const id = state.editId;
  if (!id) return closeEditModal();
  const v = readEntryFields('e');
  if (!validEntry(v)) return showAlert('Lengkapi semua field dengan angka lebih besar dari 0.');
  try {
    await updateTransaction(state.user.uid, id, v);
  } catch (e) {
    console.error('update transaction failed:', e);
    return showAlert(describeDataError(e), 'Gagal menyimpan perubahan');
  }
  const symbol = state.editAsset;
  closeEditModal();
  if (symbol) state.currentTab = symbol;
  await reloadTransactions();
  renderAll();
}

async function handleEditDelete() {
  const id = state.editId, symbol = state.editAsset;
  if (!id) return closeEditModal();
  closeEditModal();
  await handleDelEntry(symbol, id);
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
    // Render ulang tabel + ringkasan + kedua grafik agar semuanya ikut harga baru.
    renderTabContent();
    renderCharts();
    if (!$('edit-modal-backdrop').hidden) renderEditPreview();
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
/**
 * Isi otomatis dua arah untuk pasangan field harga/qty/total.
 * `prefix` = 'f' (form tambah) atau 'e' (modal edit).
 */
function autoCalcTotal(prefix) {
  const h = parseFloat($(`${prefix}-harga`)?.value);
  const u = parseFloat($(`${prefix}-unit`)?.value);
  if (Number.isFinite(h) && Number.isFinite(u)) $(`${prefix}-total`).value = (h * u).toFixed(2);
}
function autoCalcUnit(prefix) {
  const h = parseFloat($(`${prefix}-harga`)?.value);
  const t = parseFloat($(`${prefix}-total`)?.value);
  if (Number.isFinite(h) && h > 0 && Number.isFinite(t)) $(`${prefix}-unit`).value = (t / h).toFixed(6);
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

  $('edit-cancel').addEventListener('click', closeEditModal);
  $('edit-save').addEventListener('click', handleEditSave);
  $('edit-delete').addEventListener('click', handleEditDelete);

  $('fetch-prices-btn').addEventListener('click', handleFetchPrices);
  $('export-btn').addEventListener('click', exportXLSX);
  $('backup-json-btn').addEventListener('click', exportBackupJSON);

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, symbol, id, range } = el.dataset;
    switch (action) {
      case 'switch-tab':
        state.currentTab = symbol; renderAll();
        break;
      case 'open-instrument': openInstrumentModal(); break;
      case 'save-entry': handleSaveEntry(symbol); break;
      case 'edit-entry': openEditModal(symbol, id); break;
      case 'del-entry': handleDelEntry(symbol, id); break;
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
    if (!t) return;
    if (t.id === 'f-harga' || t.id === 'f-unit') autoCalcTotal('f');
    else if (t.id === 'f-total') autoCalcUnit('f');
    else if (t.id === 'e-harga' || t.id === 'e-unit') { autoCalcTotal('e'); renderEditPreview(); }
    else if (t.id === 'e-total') { autoCalcUnit('e'); renderEditPreview(); }
    else if (t.id === 'e-tanggal') renderEditPreview();
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
  banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span></span> <button type="button" aria-label="Tutup">&times;</button>`;
  banner.querySelector('span').textContent = message;
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
let currentUid;
async function handleUserChange(user) {
  const uid = user?.uid || null;
  if (uid === currentUid) return; // onAuth bisa terpanggil berulang; hindari load ganda
  currentUid = uid;

  state.user = user || null;
  state.assets = [...DEFAULT_ASSETS];
  state.data = {};
  state.editId = null;
  state.editAsset = null;
  closeBackdrop('edit-modal-backdrop');
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

    // onAuthStateChanged selalu dipanggil sekali di awal dengan user saat ini,
    // jadi tidak perlu memanggil handleUserChange manual (itu bikin load dobel).
    onAuth(handleUserChange);
  } catch (e) {
    console.error('Boot gagal:', e);
    showErrorBanner(`Aplikasi gagal dimuat: ${e.message}. Coba hard refresh (Ctrl+Shift+R) atau cek ekstensi browser.`);
  }
}

boot();
