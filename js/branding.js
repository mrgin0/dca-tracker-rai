// ============================================================
//  BRANDING — customizable family office identity
//  Cached in localStorage (instant), synced to Firestore.
// ============================================================

import { state } from './state.js?v=10';

export const DEFAULT_BRANDING = {
  title: 'Meridian',
  subtitle: 'Private Wealth · Ledger DCA',
  eyebrow: 'Ringkasan Portofolio',
  pageTitle: 'Akumulasi disiplin, dipantau dengan tenang.',
  lede: 'Catat setiap pembelian rutin, lihat valuasi terkini, dan pahami unrealized gain lintas instrumen dalam satu tampilan.',
  logo: '',
};

const CACHE_KEY = 'meridian-branding';

export function getCachedBranding() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT_BRANDING, ...JSON.parse(raw) } : { ...DEFAULT_BRANDING };
  } catch { return { ...DEFAULT_BRANDING }; }
}

export function setCachedBranding(branding) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(branding)); } catch {}
}

/** Write branding into the DOM (all logo marks, header, intro, footer). */
export function applyBranding(b) {
  state.branding = b;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('brand-mark', b.title);
  set('brand-tag', b.subtitle);
  set('intro-eyebrow', b.eyebrow);
  set('intro-title', b.pageTitle);
  set('intro-lede', b.lede);
  set('footer-brand', `${b.title} (未来) · Untuk yang Akan Datang`);
  document.title = `${b.title} — Family Office`;

  const mono = (b.title || 'M').trim().charAt(0).toUpperCase() || 'M';
  document.querySelectorAll('[data-brand-logo], .logo-preview').forEach((el) => {
    if (b.logo) {
      el.innerHTML = `<img src="${b.logo}" alt="Logo" />`;
    } else {
      el.innerHTML = `<span data-monogram>${mono}</span>`;
    }
  });
}
