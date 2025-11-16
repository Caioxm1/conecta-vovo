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

// Ouvinte de mensagens (ATUALIZADO)
messaging.onBackgroundMessage((payload) => {
  console.log("[SW v8] Mensagem em segundo plano recebida: ", payload);

  // --- LÓGICA ATUALIZADA ---
  // Agora, TODA a informação vem de 'payload.data'
  const data = payload.data;
  if (!data) {
    return console.error("[SW v8] Payload de dados vazio!");
  }

  const notificationTitle = data.title;
  let notificationOptions = {
    body: data.body,
    icon: data.icon,
    sound: data.sound, // <-- Agora o som está aqui
    tag: data.tag,
    data: data // Passa todos os dados para o 'notificationclick'
  };
  // -------------------------

  if (data.type === "incoming_call") {
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

// Ouvinte de clique (sem mudanças, já estava correto)
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action; 
  notification.close(); 
  
  // Se for uma chamada
  if (notification.data && notification.data.type === "incoming_call") {
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
  } else {
    // Se for uma mensagem de chat ou outra coisa, só abre o app
    event.waitUntil(clients.openWindow('/'));
  }
});