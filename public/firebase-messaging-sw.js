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
  console.log("[SW] Mensagem em segundo plano recebida: ", payload);

  const notificationTitle = payload.notification.title;
  let notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon,
    // Salva os dados da Cloud Function na notificação
    data: payload.data 
  };

  // --- LÓGICA ATUALIZADA ---
  // Se for uma chamada, adicionamos botões!
  if (payload.data && payload.data.type === "incoming_call") {
    notificationOptions = {
      ...notificationOptions,
      // (Opcional) Tocar um som de chamada
      // sound: "/sounds/ringtone.mp3", // (Você precisaria adicionar esse arquivo em /public/sounds)
      
      // Botões
      actions: [
        { action: "accept", title: "✅ Aceitar" },
        { action: "decline", title: "❌ Recusar" }
      ],
      // Mantém a notificação na tela até o usuário interagir
      requireInteraction: true 
    };
  }
  // -------------------------

  // Mostra a notificação
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- OUVINTE DE CLIQUE NA NOTIFICAÇÃO (NOVO) ---
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action; // Qual botão foi clicado?
  
  notification.close(); // Fecha a notificação

  // Se os dados não forem de uma chamada, não faz nada
  if (!notification.data || notification.data.type !== "incoming_call") {
    return;
  }
  
  const callData = notification.data;

  // Se o usuário clicou em "Recusar"
  if (action === 'decline') {
    // (Lógica futura: você poderia usar o 'callData.docId' para 
    // atualizar o status da chamada no Firestore para "recusada")
    return;
  }

  // Se o usuário clicou em "Aceitar" ou no corpo da notificação
  
  // 1. Montamos a URL especial (Deep Link) para abrir o app
  const urlToOpen = new URL(`/?action=accept_call&callDocId=${callData.docId}`, self.location.origin).href;

  // 2. Tenta focar em uma janela já aberta do app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      
      const hasClient = clientsArr.some((client) => {
        // Tenta encontrar uma janela que já esteja no app
        if (client.url.startsWith(self.location.origin)) {
          // Se encontrou, navega essa janela para a URL da chamada e foca nela
          client.navigate(urlToOpen); 
          client.focus();
          return true;
        }
        return false;
      });

      // 3. Se nenhuma janela do app estiver aberta, abre uma nova
      if (!hasClient) {
        clients.openWindow(urlToOpen).then((client) => client ? client.focus() : null);
      }
    })
  );
});