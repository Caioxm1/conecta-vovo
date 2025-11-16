// --- MUDANÇA 1: Importa as bibliotecas 'compat' ---
import firebase from 'firebase/compat/app';
import 'firebase/compat/messaging';
// --------------------------------------------------

import { db } from "../firebase"; // Não precisamos mais do 'app' v9
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// Esta é a chave que você copiou do Console do Firebase
const VAPID_KEY = "BEtp3Dn1ucaJRxlpIt51w-xjRhanEsbogXoS0janttQ28bAYs1ipkCR1BSOHe3SRB4AL934KNYXbmHKqPWYK9f0";

// --- MUDANÇA 2: Configuração do Firebase (precisa estar aqui) ---
// O 'compat' não "vê" a inicialização do v9 no firebase.ts
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
// -----------------------------------------------------------

// Função para pedir permissão e salvar o token
export const requestPermissionAndSaveToken = async (userId: string) => {
  
  // --- MUDANÇA 3: Inicializa o app v8 (compat) ---
  // Verifica se já foi inicializado antes
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  // -----------------------------------------------

  const supported = await firebase.messaging.isSupported();
  if (!supported) {
    console.log("Notificações Push não são suportadas neste navegador.");
    return;
  }

  // --- MUDANÇA 4: Usa o firebase.messaging() (compat) ---
  const messaging = firebase.messaging();
  // -------------------------------------------------

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Permissão de notificação concedida.");

      // --- MUDANÇA 5: Usa o messaging.getToken() (compat) ---
      const currentToken = await messaging.getToken({
        vapidKey: VAPID_KEY,
      });
      // ------------------------------------------------------

      if (currentToken) {
        console.log("Token FCM obtido:", currentToken);
        
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, {
          fcmToken: currentToken,
          tokenLastUpdated: serverTimestamp()
        }, { merge: true });

      } else {
        console.log("Não foi possível obter o token. A permissão foi concedida?");
      }
    } else {
      console.log("Permissão de notificação negada.");
    }
  } catch (err) {
    console.error("Erro ao obter permissão ou token: ", err);
  }
};