// --- MUDANÇA 1: Importa as bibliotecas 'compat' ---
import firebase from "firebase/compat/app";
import "firebase/compat/messaging";
import { getMessaging, getToken } from "firebase/messaging";
// --------------------------------------------------

import { app, db } from "../firebase"; // 'app' ainda é o v9, o que é ok
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// Esta é a chave que você copiou do Console do Firebase
const VAPID_KEY = "BEtp3Dn1ucaJRxlpIt51w-xjRhanEsbogXoS0janttQ28bAYs1ipkCR1BSOHe3SRB4AL934KNYXbmHKqPWYK9f0";

// Função para pedir permissão e salvar o token
export const requestPermissionAndSaveToken = async (userId: string) => {
  
  // --- MUDANÇA 2: Usa o 'firebase.messaging.isSupported()' (compat) ---
  const supported = await firebase.messaging.isSupported();
  if (!supported) {
    console.log("Notificações Push não são suportadas neste navegador.");
    return;
  }
  // -----------------------------------------------------------------

  // --- MUDANÇA 3: Inicializa o messaging 'compat' ---
  const messaging = firebase.messaging();
  // ------------------------------------------------

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Permissão de notificação concedida.");

      // --- MUDANÇA 4: Usa o 'messaging.getToken()' (compat) ---
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