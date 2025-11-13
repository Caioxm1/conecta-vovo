import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './firebase';
import { 
  doc, setDoc, serverTimestamp, collection, addDoc, 
  collectionGroup, query, where, onSnapshot, getDoc, Timestamp // Importações novas
} from 'firebase/firestore';

import LoginScreen from './components/LoginScreen';
import FamilyList from './components/FamilyList';
import ChatWindow from './components/ChatWindow';
import CallUI from './components/CallUI';
import type { User, Message, ActiveCall } from './types';
import { MessageType, CallState, CallType } from './types';

// A função 'showNotification' pode continuar a mesma
const showNotification = (title: string, options: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, options);
    }
}

function App() {
  const [userAuth, loadingAuth] = useAuthState(auth); 
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [chatWithUser, setChatWithUser] = useState<User | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  // useEffect que cuida do login e perfil (continua igual)
  useEffect(() => {
    if (userAuth) {
      const user: User = {
        id: userAuth.uid,
        name: userAuth.displayName || "Usuário",
        avatar: userAuth.photoURL || `https://picsum.photos/seed/${userAuth.uid}/200`,
        relationship: 'Família',
        status: 'online',
      };
      setCurrentUser(user);
      
      const userRef = doc(db, 'users', userAuth.uid);
      setDoc(userRef, { lastSeen: serverTimestamp(), status: 'online' }, { merge: true });

      if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
      }

    } else {
      setCurrentUser(null);
    }
  }, [userAuth]);

  // --- NOVO useEffect para OUVIR MENSAGENS ---
  useEffect(() => {
    if (!currentUser) return; // Não faz nada se não estiver logado

    // Guarda o momento em que o ouvinte começou
    const startupTime = Timestamp.now();

    // Isso é um 'collectionGroup query'
    // Ele escuta a sub-coleção 'messages' de TODOS os 'chats'
    const messagesRef = collectionGroup(db, 'messages');
    
    // A query: "Encontre todas as mensagens ONDE eu sou o destinatário"
    const q = query(messagesRef, where('receiverId', '==', currentUser.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        // Se a mensagem foi 'adicionada' (é nova)
        if (change.type === 'added') {
          const message = change.doc.data() as Message;

          // 1. Checa se a mensagem é realmente nova (chegou depois que o app abriu)
          // Isso evita que mensagens antigas disparem notificações
          const messageTimestamp = message.timestamp as any; // Pode ser um Timestamp ou string
          let messageTime: number;

          if (messageTimestamp?.toMillis) {
            messageTime = messageTimestamp.toMillis(); // Se for Timestamp
          } else {
            messageTime = new Date(messageTimestamp).getTime(); // Se for string
          }

          if (messageTime < startupTime.toMillis()) {
            return; // Ignora mensagens antigas
          }
          
          // 2. Não notifica se o usuário JÁ ESTÁ na janela de chat com o remetente
          if (chatWithUser && chatWithUser.id === message.senderId) {
            return;
          }

          // 3. Não notifica se a aba do navegador JÁ ESTÁ aberta e em foco
          if (document.hasFocus()) {
            return;
          }

          // 4. Se passou tudo, busca o nome do remetente
          const senderRef = doc(db, 'users', message.senderId);
          const senderSnap = await getDoc(senderRef);
          const senderName = senderSnap.data()?.name || 'Alguém';
          const senderAvatar = senderSnap.data()?.avatar;

          // 5. Mostra a notificação!
          showNotification(`Nova mensagem de ${senderName}`, {
            body: message.type === MessageType.TEXT ? message.content : 'Enviou uma mensagem de voz',
            icon: senderAvatar,
            // 'tag' faz com que novas mensagens da mesma pessoa substituam a notificação antiga
            tag: message.senderId, 
          });
        }
      });
    });

    // Limpa o ouvinte quando o usuário deslogar
    return () => unsubscribe();

  }, [currentUser, chatWithUser]); // Re-executa se o usuário logado ou o chat aberto mudarem

  // --- O resto das funções (handleLogout, handleSelectUser, etc.) ---

  const handleLogout = () => {
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.id);
      setDoc(userRef, { lastSeen: serverTimestamp(), status: 'offline' }, { merge: true });
    }
    auth.signOut();
    setCurrentUser(null);
    setChatWithUser(null);
  };

  const handleSelectUser = (user: User) => {
    setChatWithUser(user);
  };

  const handleSendMessage = async (type: MessageType, content: string, duration?: number) => {
    if (!currentUser || !chatWithUser) return;

    const chatId = currentUser.id > chatWithUser.id 
      ? `${currentUser.id}_${chatWithUser.id}` 
      : `${chatWithUser.id}_${currentUser.id}`;
    
    const messagesRef = collection(db, 'chats', chatId, 'messages');

    try {
      await addDoc(messagesRef, {
        senderId: currentUser.id,
        receiverId: chatWithUser.id,
        type,
        content,
        timestamp: serverTimestamp(),
        duration: duration || null,
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem: ", error);
    }
  };
  
  const handleStartCall = (type: 'audio' | 'video') => {
    if (!chatWithUser) return;
    alert("Função de chamada ainda não implementada.");
  };
  
  const handleAcceptCall = () => { /* ... */ };
  const handleEndCall = () => { setActiveCall(null); };

  if (loadingAuth) {
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="h-dvh w-screen font-sans overflow-hidden">
        {activeCall && <CallUI call={activeCall} onAcceptCall={handleAcceptCall} onEndCall={handleEndCall} currentUser={currentUser}/>}

        {/* --- LAYOUT PARA CELULAR --- */}
        <div className="h-full w-full md:hidden">
            {!chatWithUser ? (
                <FamilyList
                    currentUser={currentUser}
                    onSelectUser={handleSelectUser}
                    onLogout={handleLogout}
                />
            ) : (
                <ChatWindow
                    currentUser={currentUser}
                    chatWithUser={chatWithUser}
                    onSendMessage={handleSendMessage}
                    onStartCall={handleStartCall}
                    onGoBack={() => setChatWithUser(null)}
                />
            )}
        </div>

        {/* --- LAYOUT PARA DESKTOP --- */}
        <div className="hidden md:flex h-full w-full">
            <div className="w-auto">
                <FamilyList
                    currentUser={currentUser}
                    onSelectUser={handleSelectUser}
                    onLogout={handleLogout}
                />
            </div>
            <div className="flex-1 h-full">
                {chatWithUser ? (
                    <ChatWindow
                        currentUser={currentUser}
                        chatWithUser={chatWithUser}
                        onSendMessage={handleSendMessage}
                        onStartCall={handleStartCall}
                        onGoBack={() => setChatWithUser(null)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 mb-4" fill="none" viewBox="0
 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        <p className="text-2xl">Selecione uma pessoa para conversar</p>
                    </div>
                )}
            </div>
        </div>

    </div>
  );
}
 
export default App;