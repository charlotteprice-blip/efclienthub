// Single place where the app connects to Firebase. Every module comes from
// /assets/vendor/firebase, copied there by scripts/vendor.mjs, so nothing
// loads from outside Firebase Hosting.

import { initializeApp } from '/assets/vendor/firebase/firebase-app.js';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from '/assets/vendor/firebase/firebase-auth.js';
import { connectFirestoreEmulator, getFirestore } from '/assets/vendor/firebase/firebase-firestore.js';
import { connectFunctionsEmulator, getFunctions } from '/assets/vendor/firebase/firebase-functions.js';
import { FIRESTORE_DATABASE, FUNCTIONS_REGION, firebaseConfig } from './firebase-config.js';

const local = ['localhost', '127.0.0.1'].includes(location.hostname);

export const app = initializeApp(
  local ? { ...firebaseConfig, apiKey: 'demo-key', projectId: 'demo-clienthub', authDomain: location.host } : firebaseConfig,
);
export const auth = getAuth(app);
export const db = getFirestore(app, FIRESTORE_DATABASE);
export const functions = getFunctions(app, FUNCTIONS_REGION);

if (local) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

await setPersistence(auth, browserLocalPersistence);
