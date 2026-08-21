// ==========================================================================
// MONARCH — Firebase configuration
//
// This is the ONE file you must edit before multiplayer will work.
// See DEPLOYMENT.md for step-by-step instructions on creating a free
// Firebase project and getting these values.
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// ⬇️ REPLACE with your own Firebase project config (Project Settings → Your apps → SDK setup) ⬇️
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const FIREBASE_CONFIGURED = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app = null;
let db = null;

if (FIREBASE_CONFIGURED) {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
} else {
  console.warn(
    "[MONARCH] Firebase is not configured yet. Multiplayer will not work until " +
    "js/firebase-config.js is filled in with a real Firebase project. See DEPLOYMENT.md."
  );
}

export { app, db };
