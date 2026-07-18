// ============================================================
//  FIREBASE CONFIG
//  Isi kredensial dari Firebase Console → Project settings →
//  General → Your apps → Web app → SDK setup and configuration.
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// --- GANTI DENGAN KONFIG PROJECT FIREBASE LU ---
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
//  HARGA PASAR (dipertahankan seperti setup lama)
//  Endpoint proxy harga realtime. Default: Supabase Edge
//  Function `get-prices` yang sudah ter-deploy. Cukup pakai
//  sebagai proxy harga — TIDAK menyimpan histori ke database.
//  Ganti kalau punya endpoint sendiri (mis. Cloud Function).
// ============================================================
export const PRICES = {
  url: 'https://skdsddfefkipvhwwhgpr.supabase.co/functions/v1/get-prices',
  headers: {
    apikey: 'sb_publishable_YjfwjcL661wy805LRMlGOQ_EAxoWLQ2',
    Authorization: 'Bearer sb_publishable_YjfwjcL661wy805LRMlGOQ_EAxoWLQ2',
  },
};
