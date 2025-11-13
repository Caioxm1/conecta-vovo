import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth'; // Hook para ouvir a autenticação
import { auth, db } from './firebase'; // Importamos
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { requestPermissionAndSaveToken } from './src/fcm'; // <-- ADICIONADO PARA NOTIFICAÇÕES PUSH

import LoginScreen from './components/LoginScreen';
import FamilyList from './components/FamilyList';
import ChatWindow from './components/ChatWindow';
import CallUI from './components/CallUI';
import type { User, Message, ActiveCall } from './types';
import { MessageType, CallState, CallType } from './types';

// A função 'showNotification' para notificações DENTRO do app (quando a aba está inativa)
const showNotification = (title: string, options: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, options);
    }
}

function App() {
  // O hook 'useAuthState' cuida de 'currentUser' e 'loading' automaticamente
  const [userAuth, loadingAuth] = useAuthState(auth); 
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [chatWithUser, setChatWithUser] = useState<User | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  // Este 'useEffect' converte o 'userAuth' do Firebase para o nosso tipo 'User'
  useEffect(() => {
    if (userAuth) {
      // Converte o usuário do Auth para o nosso tipo 'User'
      const user: User = {
        id: userAuth.uid,
        name: userAuth.displayName || "Usuário",
        avatar: userAuth.photoURL || `https://picsum.photos/seed/${userAuth.uid}/200`,
        relationship: 'Família', // Placeholder
        status: 'online', // Placeholder
      };
      setCurrentUser(user);
      
      // Atualiza o 'lastSeen' no Firestore
      const userRef = doc(db, 'users', userAuth.uid);
      setDoc(userRef, { lastSeen: serverTimestamp(), status: 'online' }, { merge: true });

      // --- SUBSTITUÍDO ---
      // O bloco antigo de 'requestPermission' foi removido
      
      // --- ADICIONADO ---
      // Pede permissão e salva o token FCM para notificações PUSH
      requestPermissionAndSaveToken(userAuth.uid);

    } else {
      setCurrentUser(null);
    }
  }, [userAuth]);

  // Os 'useEffect' de notificação de mensagem (quando o app está aberto)
  // ... (Nós o removemos temporariamente para focar no PUSH, podemos readicionar depois se necessário) ...

  const handleLogout = () => {
    // Atualiza o status para offline antes de deslogar
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.id);
      setDoc(userRef, { lastSeen: serverTimestamp(), status: 'offline' }, { merge: true });
    }
    auth.signOut(); // Simples assim
    setCurrentUser(null);
    setChatWithUser(null);
  };

  const handleSelectUser = (user: User) => {
    setChatWithUser(user);
  };

  // Esta função agora salva a mensagem no Firestore
  const handleSendMessage = async (type: MessageType, content: string, duration?: number) => {
    if (!currentUser || !chatWithUser) return;

    // Cria um ID de chat único e ordenado
    const chatId = currentUser.id > chatWithUser.id 
      ? `${currentUser.id}_${chatWithUser.id}` 
      : `${chatWithUser.id}_${currentUser.id}`;
    
    // Referência para a sub-coleção de mensagens dentro do chat
    const messagesRef = collection(db, 'chats', chatId, 'messages');

    try {
      await addDoc(messagesRef, {
        senderId: currentUser.id,
        receiverId: chatWithUser.id,
        type,
        content,
        timestamp: serverTimestamp(), // Usa o timestamp do servidor
        duration: duration || null,
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem: ", error);
    }
  };
  
  // Vamos deixar as chamadas para depois
  const handleStartCall = (type: 'audio' | 'video') => {
    if (!chatWithUser) return;
    alert("Função de chamada ainda não implementada.");
  };
  
  const handleAcceptCall = () => {
    // TODO: Implementar com WebRTC
  };
  
  const handleEndCall = () => {
    // TODO: Implementar com WebRTC
    setActiveCall(null);
  };

  if (loadingAuth) {
    // Você pode criar um componente de 'Loading' bonito aqui
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }

  if (!currentUser) {
    return <LoginScreen />; // Não precisa mais de props
  }

  return (
    <div className="h-dvh w-screen font-sans overflow-hidden">
        {activeCall && <CallUI call={activeCall} onAcceptCall={handleAcceptCall} onEndCall={handleEndCall} currentUser={currentUser}/>}

        {/* --- LAYOUT PARA CELULAR --- */}
        {/* Mostra SÓ a lista OU SÓ o chat. O 'md:hidden' esconde isso no desktop. */}
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
                    // Props 'messages' e 'isTyping' removidas (corrigido)
                    onSendMessage={handleSendMessage}
                    onStartCall={handleStartCall}
                    onGoBack={() => setChatWithUser(null)}
                />
            )}
        </div>

        {/* --- LAYOUT PARA DESKTOP --- */}
        {/* Mostra os dois lado a lado. O 'hidden' esconde isso no celular. */}
        <div className="hidden md:flex h-full w-full">
            {/* Lado Esquerdo: Lista */}
            <div className="w-auto">
                <FamilyList
                    currentUser={currentUser}
                    onSelectUser={handleSelectUser}
                    onLogout={handleLogout}
                />
            </div>
            {/* Lado Direito: Chat ou Placeholder */}
            <div className="flex-1 h-full">
                {chatWithUser ? (
                    <ChatWindow
                        currentUser={currentUser}
                        chatWithUser={chatWithUser}
                        // Props 'messages' e 'isTyping' removidas (corrigido)
                        onSendMessage={handleSendMessage}
                        onStartCall={handleStartCall}
                        onGoBack={() => setChatWithUser(null)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        <p className="text-2xl">Selecione uma pessoa para conversar</p>
                    </div>
                )}
            </div>
        </div>

    </div>
  );
}

// Linhas duplicadas ou desnecessárias removidas
 
export default App;