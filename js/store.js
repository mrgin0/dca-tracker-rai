// ============================================================
//  STORE — Firestore data layer
//  Structure:
//    users/{uid}/assets/{id}          custom instruments
//    users/{uid}/transactions/{id}    DCA purchases
//    users/{uid}/meta/branding        display settings
//    users/{uid}/meta/marketPrices    LAST fetched prices only
//                                     (single doc, always overwritten —
//                                      not a growing history/log)
// ============================================================

import {
  collection, doc, getDoc, setDoc, getDocs, addDoc, updateDoc, deleteDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase-config.js?v=10';

const assetsCol = (uid) => collection(db, 'users', uid, 'assets');
const txCol = (uid) => collection(db, 'users', uid, 'transactions');
const brandingDoc = (uid) => doc(db, 'users', uid, 'meta', 'branding');
const pricesDoc = (uid) => doc(db, 'users', uid, 'meta', 'marketPrices');
const notesCol = (uid) => collection(db, 'users', uid, 'notes');

const numOr = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// PENTING: query TIDAK memakai orderBy(). Firestore diam-diam membuang dokumen
// yang tidak punya field pengurut — dokumen lama tanpa `createdAt`/`tanggal`
// akan hilang dari hasil dan bikin total tidak sinkron. Urutan diatur di JS.

// ---------- ASSETS ----------
export async function fetchAssets(uid) {
  const snap = await getDocs(assetsCol(uid));
  return snap.docs
    .map((d) => {
      const r = d.data() || {};
      return {
        id: d.id,
        symbol: r.symbol,
        name: r.name || r.symbol,
        unit: r.unit || 'unit',
        yahoo: r.yahoo || '',
        isDefault: false,
        _created: r.createdAt?.toMillis?.() ?? 0,
      };
    })
    .filter((a) => !!a.symbol)
    .sort((a, b) => a._created - b._created);
}

export function createAsset(uid, { symbol, name, unit, yahoo }) {
  return addDoc(assetsCol(uid), { symbol, name, unit, yahoo, createdAt: serverTimestamp() });
}

export function deleteAsset(uid, id) {
  return deleteDoc(doc(db, 'users', uid, 'assets', id));
}

// ---------- TRANSACTIONS ----------
export async function fetchTransactions(uid) {
  const snap = await getDocs(txCol(uid));
  return snap.docs
    .map((d) => {
      const r = d.data() || {};
      return {
        id: d.id,
        asset: r.asset,
        tanggal: r.tanggal || '',
        hargaBeli: numOr(r.hargaBeli),
        jumlahUnit: numOr(r.jumlahUnit),
        totalBeli: numOr(r.totalBeli, numOr(r.hargaBeli) * numOr(r.jumlahUnit)),
      };
    })
    .filter((t) => !!t.asset)
    .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
}

export function createTransaction(uid, tx) {
  return addDoc(txCol(uid), { ...tx, createdAt: serverTimestamp() });
}

export function updateTransaction(uid, id, tx) {
  return updateDoc(doc(db, 'users', uid, 'transactions', id), tx);
}

export function deleteTransaction(uid, id) {
  return deleteDoc(doc(db, 'users', uid, 'transactions', id));
}

// ---------- BRANDING ----------
export async function getBranding(uid) {
  const snap = await getDoc(brandingDoc(uid));
  return snap.exists() ? snap.data() : null;
}

export function saveBranding(uid, data) {
  return setDoc(brandingDoc(uid), data, { merge: true });
}

// ---------- LAST MARKET-PRICE SNAPSHOT ----------
// Satu dokumen TETAP (path selalu sama), ditimpa PENUH setiap fetch.
// Ini menjamin cuma ada 1 record — bukan histori/log yang menumpuk.
export async function getLastPriceSnapshot(uid) {
  const snap = await getDoc(pricesDoc(uid));
  return snap.exists() ? snap.data() : null;
}

export function saveLastPriceSnapshot(uid, { prices, fetchedAt }) {
  // setDoc TANPA { merge:true } → dokumen lama sepenuhnya digantikan, bukan ditambah.
  return setDoc(pricesDoc(uid), { prices, fetchedAt });
}

// ---------- NOTES ----------
// users/{uid}/notes/{id} -> { text, createdAt, updatedAt }
// Timestamp disimpan sebagai string ISO supaya urutan & tampilannya tidak
// bergantung pada serverTimestamp yang sempat null tepat setelah ditulis.
export async function fetchNotes(uid) {
  const snap = await getDocs(notesCol(uid));
  return snap.docs
    .map((d) => {
      const r = d.data() || {};
      return {
        id: d.id,
        text: String(r.text || ''),
        createdAt: r.createdAt || '',
        updatedAt: r.updatedAt || r.createdAt || '',
      };
    })
    .filter((n) => n.text.trim().length > 0)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function createNote(uid, text) {
  const now = new Date().toISOString();
  return addDoc(notesCol(uid), { text: String(text), createdAt: now, updatedAt: now });
}

export function updateNote(uid, id, text) {
  return updateDoc(doc(db, 'users', uid, 'notes', id), {
    text: String(text), updatedAt: new Date().toISOString(),
  });
}

export function deleteNote(uid, id) {
  return deleteDoc(doc(db, 'users', uid, 'notes', id));
}
