// ============================================================
//  AUTH — Firebase email/password
// ============================================================

import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth } from './firebase-config.js';

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOut() {
  return fbSignOut(auth);
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
