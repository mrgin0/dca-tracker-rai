// ============================================================
//  UTILITIES — formatters, helpers, modal, theme
// ============================================================

export function fmt(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function fmtN(n, dec = 6) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dec });
}
export function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
}
export function safeId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '_'); }

export function hexToRgba(hex, alpha) {
  const h = String(hex || '#999').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function formatDateWITA(dateStr) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
      timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}
export function todayISO() { return new Date().toISOString().slice(0, 10); }

// ---------- THEME ----------
export function applyTheme(mode) {
  document.body.classList.toggle('dark', mode === 'dark');
  const btn = document.getElementById('theme-btn');
  if (btn) {
    btn.innerHTML = mode === 'dark'
      ? '<i class="fa-regular fa-sun"></i><span>Light</span>'
      : '<i class="fa-regular fa-moon"></i><span>Dark</span>';
  }
  try { localStorage.setItem('meridian-theme', mode); } catch {}
}
export function initTheme() {
  let mode = 'light';
  try { mode = localStorage.getItem('meridian-theme') || 'light'; } catch {}
  applyTheme(mode);
}

// ---------- MODAL ----------
export function showModal({ title = 'Info', message = '', type = 'info', confirm = false, okText = 'OK', cancelText = 'Batal' } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.getElementById('app-modal-backdrop');
    const titleEl = document.getElementById('app-modal-title');
    const msgEl = document.getElementById('app-modal-message');
    const actions = document.getElementById('app-modal-actions');
    const icon = document.getElementById('app-modal-icon');

    titleEl.textContent = title;
    msgEl.textContent = String(message || '');
    icon.className = 'modal-icon' + (type === 'danger' ? ' danger' : '');
    icon.innerHTML = type === 'danger'
      ? '<i class="fa-solid fa-triangle-exclamation"></i>'
      : '<i class="fa-solid fa-circle-info"></i>';
    actions.innerHTML = '';

    const close = (val) => { backdrop.hidden = true; resolve(val); };

    if (confirm) {
      const cancel = document.createElement('button');
      cancel.className = 'btn'; cancel.textContent = cancelText; cancel.onclick = () => close(false);
      const ok = document.createElement('button');
      ok.className = 'btn ' + (type === 'danger' ? 'btn-danger' : 'btn-primary');
      ok.textContent = okText; ok.onclick = () => close(true);
      actions.append(cancel, ok);
    } else {
      const ok = document.createElement('button');
      ok.className = 'btn btn-primary'; ok.textContent = okText; ok.onclick = () => close(true);
      actions.append(ok);
    }

    backdrop.hidden = false;
    const esc = (e) => { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(false); } };
    document.addEventListener('keydown', esc, { once: true });
  });
}
export function showAlert(message, title = 'Info') { return showModal({ title, message, type: 'info' }); }
export function showConfirm(message, title = 'Konfirmasi', type = 'danger') {
  return showModal({ title, message, type, confirm: true, okText: 'Ya, lanjut', cancelText: 'Batal' });
}
