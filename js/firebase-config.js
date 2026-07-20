// ============================================================
//  FIREBASE CONFIG
//  Sudah diisi dengan project: family-office-3b102
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDFyunVx6vAiFWKsvNU1izsoUdvz5tXCW0',
  authDomain: 'family-office-3b102.firebaseapp.com',
  projectId: 'family-office-3b102',
  storageBucket: 'family-office-3b102.firebasestorage.app',
  messagingSenderId: '1081122098957',
  appId: '1:1081122098957:web:6517cf5ae17f1c63e46a44',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ============================================================
//  HARGA PASAR — Cloudflare Worker gratis milik Anda sendiri
//  Ganti 'GANTI-URL-WORKER-ANDA' di bawah dengan URL Worker
//  setelah deploy. Panduan lengkap: SETUP-HARGA-GRATIS.md
//  Tidak menyimpan histori harga ke database.
// ============================================================
export const PRICES = {
  url: 'https://get-prices.raihan-nor-falah.workers.dev/',
  headers: {},
};
