// ============================================================
//  STORE — Firestore data layer
//  Structure:
//    users/{uid}/assets/{id}        custom instruments
//    users/{uid}/transactions/{id}  DCA purchases
//    users/{uid}/meta/branding      display settings
//  (No market-price history is ever written.)
// ============================================================

import {
  collection, doc, getDoc, setDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase-config.js';

const assetsCol = (uid) => collection(db, 'users', uid, 'assets');
const txCol = (uid) => collection(db, 'users', uid, 'transactions');
const brandingDoc = (uid) => doc(db, 'users', uid, 'meta', 'branding');

// ---------- ASSETS ----------
export async function fetchAssets(uid) {
  const snap = await getDocs(query(assetsCol(uid), orderBy('createdAt', 'asc')));
  return snap.docs.map((d) => {
    const r = d.data();
    return { id: d.id, symbol: r.symbol, name: r.name || r.symbol, unit: r.unit || 'unit', yahoo: r.yahoo || '', isDefault: false };
  });
}

export function createAsset(uid, { symbol, name, unit, yahoo }) {
  return addDoc(assetsCol(uid), { symbol, name, unit, yahoo, createdAt: serverTimestamp() });
}

export function deleteAsset(uid, id) {
  return deleteDoc(doc(db, 'users', uid, 'assets', id));
}

// ---------- TRANSACTIONS ----------
export async function fetchTransactions(uid) {
  const snap = await getDocs(query(txCol(uid), orderBy('tanggal', 'asc')));
  return snap.docs.map((d) => {
    const r = d.data();
    return {
      id: d.id,
      asset: r.asset,
      tanggal: r.tanggal,
      hargaBeli: Number(r.hargaBeli),
      jumlahUnit: Number(r.jumlahUnit),
      totalBeli: Number(r.totalBeli),
    };
  });
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
