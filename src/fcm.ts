// Importa o 'firebase' (v8) que inicializamos
import { firebase, db } from "../firebase"; 
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const VAPID_KEY = "BEtp3Dn1ucaJRxlpIt51w-xjRhanEsbogXoS0janttQ28bAYs1ipkCR1BSOHe3SRB4AL934KNYXbmHKqPWYK9f0";

export const requestPermissionAndSaveToken = async (userId: string) => {
  
  const supported = await firebase.messaging.isSupported();
  if (!supported) {
    console.log("Notificações Push não são suportadas neste navegador.");
    return;
  }

  const messaging = firebase.messaging();

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Permissão de notificação concedida.");

      const currentToken = await messaging.getToken({
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