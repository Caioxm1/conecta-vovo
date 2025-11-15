// Importa as funções V2
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Inicializa o Admin (Super-Usuário)
initializeApp();

const db = getFirestore();
const messaging = getMessaging();

/**
 * Função 1: Acionada quando uma NOVA MENSAGEM DE CHAT é criada
 */
export const sendNotificationOnNewMessage = onDocumentCreated("/chats/{chatId}/messages/{messageId}", async (event) => {
    
    // 1. Pega os dados da mensagem
    const snapshot = event.data;
    if (!snapshot) {
        logger.log("No data associated with the event.");
        return;
    }
    const message = snapshot.data();
    if (!message) {
        logger.log("Nenhum dado na mensagem.");
        return;
    }

    const { senderId, receiverId, type, content } = message;

    // 2. Busca o perfil do DESTINATÁRIO para pegar o token
    const receiverRef = db.doc(`users/${receiverId}`);
    const receiverDoc = await receiverRef.get();
    if (!receiverDoc.exists) {
        logger.log("Destinatário não encontrado.");
        return;
    }
    const receiverData = receiverDoc.data();
    const fcmToken = receiverData?.fcmToken;
    if (!fcmToken) {
        logger.log("Destinatário não possui token FCM.");
        return;
    }

    // 3. Busca o perfil do REMETENTE para pegar o nome
    const senderRef = db.doc(`users/${senderId}`);
    const senderDoc = await senderRef.get();
    const senderName = senderDoc.data()?.name || "Alguém";
    const senderAvatar = senderDoc.data()?.avatar;

    // 4. Monta a notificação
    const payload = {
        notification: {
            title: `Nova mensagem de ${senderName}`,
            body: type === "text" ? content : "Enviou uma mensagem de voz",
        },
        webpush: {
            notification: {
                icon: senderAvatar || "https://firebase.google.com/static/images/brand-guidelines/logo-vertical.svg",
            },
        },
        token: fcmToken,
    };

    // 5. Envia a notificação
    logger.log(`Enviando notificação de CHAT para: ${fcmToken}`);
    try {
        await messaging.send(payload);
        logger.log("Notificação de CHAT enviada com sucesso.");
    } catch (error) {
        logger.error("Erro ao enviar notificação de CHAT:", error);
    }
});


/**
 * --- NOVA FUNÇÃO ---
 * Função 2: Acionada quando uma NOVA CHAMADA é criada
 */
export const sendCallNotification = onDocumentCreated("/calls/{callId}", async (event) => {
    
    // 1. Pega os dados da chamada
    const snapshot = event.data;
    if (!snapshot) {
        logger.log("Chamada: Nenhum dado no evento.");
        return;
    }
    const callData = snapshot.data();
    if (!callData) {
        logger.log("Chamada: Nenhum dado na chamada.");
        return;
    }

    // Se o status não for "ringing", ignora (ex: chamada já ativa)
    if (callData.status !== "ringing") {
        logger.log("Chamada: Status não é 'ringing', ignorando.");
        return;
    }

    const { callerId, receiverId, channelName, type, docId } = callData;

    // 2. Buscar o token do destinatário (receiver)
    const receiverDoc = await db.doc(`users/${receiverId}`).get();
    if (!receiverDoc.exists) {
        logger.log("Chamada: Destinatário não encontrado.");
        return;
    }
    const fcmToken = receiverDoc.data()?.fcmToken;
    if (!fcmToken) {
        logger.log("Chamada: Destinatário não possui token FCM.");
        return;
    }

    // 3. Buscar o nome de quem liga (caller)
    const callerDoc = await db.doc(`users/${callerId}`).get();
    const callerName = callerDoc.data()?.name || "Alguém";
    const callerAvatar = callerDoc.data()?.avatar;

    // 4. Montar o PAYLOAD DE DADOS (A parte mais importante)
    const payload = {
        token: fcmToken,
        
        // 'notification' é o que o usuário VÊ
        notification: {
            title: `📞 ${callerName} está te ligando...`,
            body: `Clique para ${callData.type === 'video' ? 'atender a chamada de vídeo' : 'atender a chamada de áudio'}.`,
            icon: callerAvatar || "https".concat("://firebase.google.com/static/images/brand-guidelines/logo-vertical.svg"), // (Você pode trocar por um ícone seu na pasta /public)
        },
        
        // 'data' é o que o Service Worker VAI USAR
        data: {
            type: "incoming_call", // Para o SW saber que é uma chamada
            callerName: callerName,
            callerId: callerId,
            docId: docId, // O ID do documento da chamada
            channelName: channelName,
            callType: type,
        }
    };

    // 5. Envia a notificação
    logger.log(`Enviando notificação de CHAMADA para: ${fcmToken}`);
    try {
        await messaging.send(payload);
        logger.log("Notificação de CHAMADA enviada!");
    } catch (error) {
        logger.error("Erro ao enviar notificação de CHAMADA:", error);
    }
});