import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAyItliaY28XtKPahQCYIW2gSBfI-Pg-q0",
  authDomain: "e-medics-3d749.firebaseapp.com",
  projectId: "e-medics-3d749",
  storageBucket: "e-medics-3d749.firebasestorage.app",
  messagingSenderId: "94414958137",
  appId: "1:94414958137:web:b8f970bdcab3b9606aa7e8",
  measurementId: "G-848PMQPYFF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export default app;
