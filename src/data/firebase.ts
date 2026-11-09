// Firebase setup from VITE_FIREBASE_* values in .env (see .env.example).
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const ENV_NAMES: Record<keyof typeof config, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

/** Names of .env values that are missing; the app shows a setup message instead of loading when any are. */
export const missingConfig = (Object.keys(config) as (keyof typeof config)[]).filter((k) => !config[k]).map((k) => ENV_NAMES[k]);

let db: Firestore | null = null;

/** Firestore with a persistent IndexedDB cache, so revisits load from cache and pages read offline after a first visit. */
export function firestore(): Firestore {
  if (missingConfig.length) throw new Error(`Missing Firebase config: ${missingConfig.join(', ')}`);
  db ??= initializeFirestore(initializeApp(config), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return db;
}
