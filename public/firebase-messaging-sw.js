// Scripts v8 "compat"
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyDLGOHvT6qQ2XzbK81GvuqiN1bE_TaYhx0",
  authDomain: "app-de-conversa-d166d.firebaseapp.com",
  projectId: "app-de-conversa-d166d",
  storageBucket: "app-de-conversa-d166d.firebasestorage.app",
  messagingSenderId: "838642513898",
  appId: "1:838642513898:web:32416d61f47f78eb69e493"
};

// Sintaxe v8 "compat"
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Ouvinte de mensagens (sem mudanças)
messaging.onBackgroundMessage((payload) => {
  console.log("[SW v8] Mensagem em segundo plano recebida: ", payload);
  const notificationTitle = payload.notification.title;
  
  let notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon,
    sound: payload.notification.sound, 
    data: payload.data 
  };

  if (payload.data && payload.data.type === "incoming_call") {
    notificationOptions = {
      ...notificationOptions,
      actions: [
        { action: "accept", title: "✅ Aceitar" },
        { action: "decline", title: "❌ Recusar" }
      ],
      requireInteraction: true 
    };
  }
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Ouvinte de clique (sem mudanças)
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action; 
  notification.close(); 
  if (!notification.data || notification.data.type !== "incoming_call") {
    return event.waitUntil(clients.openWindow('/'));
  }
  const callData = notification.data;
  if (action === 'decline') return;
  const urlToOpen = new URL(`/?action=accept_call&callDocId=${callData.docId}`, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const hasClient = clientsArr.some((client) => {
        if (client.url.startsWith(self.location.origin)) {
          client.navigate(urlToOpen); 
          client.focus();
          return true;
        }
        return false;
      });
      if (!hasClient) {
        clients.openWindow(urlToOpen).then((client) => client ? client.focus() : null);
      }
    })
  );
});