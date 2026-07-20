// ============================================================
//  AUTH — Firebase email/password
// ============================================================

import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth } from './firebase-config.js';

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Kirim email reset password lewat Firebase.
export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export function signOut() {
  return fbSignOut(auth);
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
