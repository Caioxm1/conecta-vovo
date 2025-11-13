// Importa os scripts do Firebase (necessário no Service Worker)
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

// IMPORTANTE: Cole a MESMA configuração do seu arquivo 'firebase.ts' aqui
const firebaseConfig = {
  apiKey: "AIzaSyDLGOHvT6qQ2XzbK81GvuqiN1bE_TaYhx0",
  authDomain: "app-de-conversa-d166d.firebaseapp.com",
  projectId: "app-de-conversa-d166d",
  storageBucket: "app-de-conversa-d166d.firebasestorage.app",
  messagingSenderId: "838642513898",
  appId: "1:838642513898:web:32416d61f47f78eb69e493"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Pega a instância do Messaging
const messaging = firebase.messaging();

// Adiciona o "ouvinte" de mensagens em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Recebida mensagem em segundo plano: ", payload);

  // Pega os dados da notificação (que NÓS VAMOS definir na Parte 2)
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon,
  };

  // Mostra a notificação
  self.registration.showNotification(notificationTitle, notificationOptions);
});