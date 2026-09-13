// auth/firebaseConfig.js
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin if not already initialized
const initializeFirebaseAdmin = () => {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Handle newlines in private key
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
        console.log('Firebase Admin initialized successfully');
      } else {
        console.warn('[Warning] WARNING: Firebase Admin environment variables are missing. Firebase features will be disabled.');
      }
    } catch (e) {
      console.error('[Error] Failed to initialize Firebase Admin SDK in firebaseConfig:', e.message);
    }
  }
  return admin;
};

export default initializeFirebaseAdmin;