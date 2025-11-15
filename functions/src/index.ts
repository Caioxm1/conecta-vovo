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
 * Esta é a Cloud Function (Sintaxe V2).
 * Ela é acionada sempre que um novo documento é criado em
 * /chats/{chatId}/messages/{messageId}
 */
export const sendNotificationOnNewMessage = onDocumentCreated("/chats/{chatId}/messages/{messageId}", async (event) => {
    
    // 1. Pega os dados da mensagem que acabou de ser criada
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

    // Se o destinatário não tiver um token (não ativou notificação), paramos.
    if (!fcmToken) {
        logger.log("Destinatário não possui token FCM.");
        return;
    }

    // 3. Busca o perfil do REMETENTE para pegar o nome
    const senderRef = db.doc(`users/${senderId}`);
    const senderDoc = await senderRef.get();
    const senderName = senderDoc.data()?.name || "Alguém";
    const senderAvatar = senderDoc.data()?.avatar;

    // 4. Monta a notificação (o "payload")
    const payload = {
        // Objeto de notificação padrão (só title e body)
        notification: {
            title: `Nova mensagem de ${senderName}`,
            body: type === "text" ? content : "Enviou uma mensagem de voz",
        },
        // --- A CORREÇÃO ESTÁ AQUI ---
        // Configuração específica para Web (para o ícone)
        webpush: {
            notification: {
                icon: senderAvatar || "https://firebase.google.com/static/images/brand-guidelines/logo-vertical.svg",
            },
        },
        token: fcmToken, // O token do destinatário
    };

    // 5. Envia a notificação para o token (endereço) do destinatário
    logger.log(`Enviando notificação para o token: ${fcmToken}`);
    try {
        await messaging.send(payload); // A V2 usa .send(payload)
        logger.log("Notificação enviada com sucesso.");
    } catch (error) {
        logger.error("Erro ao enviar notificação:", error);
    }
});