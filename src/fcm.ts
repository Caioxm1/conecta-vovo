import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app, db } from "../firebase"; // Caminho '../firebase'
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// Esta é a chave que você copiou do Console do Firebase
const VAPID_KEY = "BEtp3Dn1ucaJRxlpIt51w-xjRhanEsbogXoS0janttQ28bAYs1ipkCR1BSOHe3SRB4AL934KNYXbmHKqPWYK9f0";

// Função para pedir permissão e salvar o token
export const requestPermissionAndSaveToken = async (userId: string) => {
  const supported = await isSupported();
  if (!supported) {
    console.log("Notificações Push não são suportadas neste navegador.");
    return;
  }

  const messaging = getMessaging(app); // v9

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Permissão de notificação concedida.");

      // getToken (v9) agora vai funcionar com o Service Worker (v9)
      const currentToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
      });

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