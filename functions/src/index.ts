import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

/**
 * Função 1: Notificação de CHAT
 */
export const sendNotificationOnNewMessage = onDocumentCreated("/chats/{chatId}/messages/{messageId}", async (event) => {
    
    const snapshot = event.data;
    if (!snapshot) return;
    const message = snapshot.data();
    if (!message) return;

    const { senderId, receiverId, type, content } = message;

    const receiverRef = db.doc(`users/${receiverId}`);
    const receiverDoc = await receiverRef.get();
    if (!receiverDoc.exists) return;
    
    const fcmToken = receiverDoc.data()?.fcmToken;
    if (!fcmToken) return;

    const senderRef = db.doc(`users/${senderId}`);
    const senderDoc = await senderRef.get();
    const senderName = senderDoc.data()?.name || "Alguém";
    const senderAvatar = senderDoc.data()?.avatar;

    const payload = {
        notification: {
            title: `Nova mensagem de ${senderName}`,
            body: type === "text" ? content : (type === "image" ? "Enviou uma foto" : "Enviou uma mensagem de voz"),
        },
        webpush: {
            notification: {
                icon: senderAvatar || "https://firebase.google.com/static/images/brand-guidelines/logo-vertical.svg",
                sound: "/sounds/message.mp3", // <-- Som de Mensagem
                tag: `chat-${senderId}`, 
                renotify: true,
            },
        },
        token: fcmToken,
    };

    logger.log(`Enviando notificação de CHAT para: ${fcmToken}`);
    try {
        await messaging.send(payload);
    } catch (error) {
        logger.error("Erro ao enviar notificação de CHAT:", error);
    }
});


/**
 * Função 2: Notificação de CHAMADA
 */
export const sendCallNotification = onDocumentCreated("/calls/{callId}", async (event) => {
    
    const snapshot = event.data;
    if (!snapshot) return;
    const callData = snapshot.data();
    if (!callData) return;

    if (callData.status !== "ringing") return;

    const { callerId, receiverId, channelName, type, docId } = callData;

    const receiverDoc = await db.doc(`users/${receiverId}`).get();
    if (!receiverDoc.exists) return;
    
    const fcmToken = receiverDoc.data()?.fcmToken;
    if (!fcmToken) return;

    const callerDoc = await db.doc(`users/${callerId}`).get();
    const callerName = callerDoc.data()?.name || "Alguém";
    const callerAvatar = callerDoc.data()?.avatar;

    const payload = {
        token: fcmToken,
        
        notification: {
            title: `📞 ${callerName} está te ligando...`,
            body: `Clique para ${callData.type === 'video' ? 'atender a chamada de vídeo' : 'atender a chamada de áudio'}.`,
        },
        
        webpush: {
            notification: {
                icon: callerAvatar || "https".concat("://firebase.google.com/static/images/brand-guidelines/logo-vertical.svg"),
                sound: "/sounds/ringtone.mp3", // <-- Som da Chamada
                tag: "incoming-call", 
                renotify: true,
            }
        },
        
        data: {
            type: "incoming_call",
            callerName: callerName,
            callerId: callerId,
            docId: docId, 
            channelName: channelName,
            callType: type,
        }
    };

    logger.log(`Enviando notificação de CHAMADA para: ${fcmToken}`);
    try {
        await messaging.send(payload);
    } catch (error) {
        logger.error("Erro ao enviar notificação de CHAMADA:", error);
    }
});