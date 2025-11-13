import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth'; // Hook para ouvir a autenticação
import { auth, db } from './firebase'; // Importamos
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';

import LoginScreen from './components/LoginScreen';
import FamilyList from './components/FamilyList';
import ChatWindow from './components/ChatWindow';
import CallUI from './components/CallUI';
import type { User, Message, ActiveCall } from './types';
import { MessageType, CallState, CallType } from './types';

// Não precisamos mais de 'familyMembers' ou 'initialMessages'
// Eles virão do banco de dados

// A função 'showNotification' pode continuar a mesma
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
  // O estado 'messages' foi removido. O ChatWindow vai buscar suas próprias mensagens.
  // O 'typingUser' foi removido por simplicidade.

  // Este 'useEffect' converte o 'userAuth' do Firebase para o nosso tipo 'User'
  useEffect(() => {
    if (userAuth) {
      // Converte o usuário do Auth para o nosso tipo 'User'
      // O 'relationship' e 'status' precisarão de uma lógica mais complexa
      // no futuro (ex: buscar de um perfil no Firestore)
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

      // Pedir permissão de notificação
      if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
      }

    } else {
      setCurrentUser(null);
    }
  }, [userAuth]);

  // Os 'useEffect' de notificação de mensagem e chamada podem ser
  // implementados depois com 'listeners' do Firestore. Por enquanto, vamos focar no envio.

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
    // O código antigo de 'setActiveCall' está comentado
    /*
    setActiveCall({
        state: CallState.OUTGOING,
        type: type === 'audio' ? CallType.AUDIO : CallType.VIDEO,
        withUser: chatWithUser
    });
    */
  };
  
  const handleAcceptCall = () => {
    // TODO: Implementar com WebRTC
  };
  
  const handleEndCall = () => {
    // TODO: Implementar com WebRTC
    setActiveCall(null);
  };

  // 'getFilteredMessages' não é mais necessário.

  if (loadingAuth) {
    // Você pode criar um componente de 'Loading' bonito aqui
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }

  if (!currentUser) {
    return <LoginScreen />; // Não precisa mais de props
  }

  return (
    <div className="flex h-screen font-sans">
        {/* O 'activeCall' está desabilitado por enquanto */}
        {/* {activeCall && <CallUI call={activeCall} onAcceptCall={handleAcceptCall} onEndCall={handleEndCall} currentUser={currentUser}/>} */}
        
        <div className={`transition-transform duration-300 ease-in-out ${chatWithUser ? '-translate-x-full md:translate-x-0' : 'translate-x-0'} md:block`}>
            <FamilyList
                currentUser={currentUser}
                // 'family' e 'allUsers' serão buscados DENTRO do FamilyList
                // 'messages' foi removido
                onSelectUser={handleSelectUser}
                onLogout={handleLogout}
            />
        </div>
        <div className={`absolute top-0 left-0 w-full h-full md:relative transition-transform duration-300 ease-in-out ${chatWithUser ? 'translate-x-0' : 'translate-x-full'}`}>
            {chatWithUser ? (
            <ChatWindow
                currentUser={currentUser}
                chatWithUser={chatWithUser}
                // 'messages' e 'isTyping' foram removidos
                // O ChatWindow vai buscar suas próprias mensagens
                onSendMessage={handleSendMessage}
                onStartCall={handleStartCall}
                onGoBack={() => setChatWithUser(null)}
            />
            ) : (
                <div className="hidden md:flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <p className="text-2xl">Selecione uma pessoa para conversar</p>
                </div>
            )}
        </div>
    </div>
  );
}

export default App;