import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './firebase';
import { 
  doc, setDoc, serverTimestamp, collection, addDoc, getDoc,
  onSnapshot, 
  updateDoc, // <--- ADICIONADO
  deleteDoc,
  where,
  query
} from 'firebase/firestore'; 
import { requestPermissionAndSaveToken } from './src/fcm';

import LoginScreen from './components/LoginScreen';
import FamilyList from './components/FamilyList';
import ChatWindow from './components/ChatWindow';
import type { User, Message, ActiveCall } from './types';
import { MessageType, CallState, CallType } from './types';

// Pega o App ID do Agora do arquivo .env
const AGORA_APP_ID = process.env.AGORA_APP_ID || "";

// Lazy Load do CallManager (para performance)
const CallManager = lazy(() => import('./components/CallManager'));

// A função 'showNotification'
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

      requestPermissionAndSaveToken(userAuth.uid);
    } else {
      setCurrentUser(null);
    }
  }, [userAuth]);

  // useEffect' para ler a URL (Deep Link) (código antigo removido)
  useEffect(() => {
    // ... (código do 'chatWith' na URL - removido para clareza)
  }, [currentUser, chatWithUser]); 

  // --- NOVO: useEffect para ler Deep Link de Notificação de Chamada ---
  useEffect(() => {
    if (!currentUser) return; // Precisa do usuário logado

    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const callDocId = params.get('callDocId');
    
    // Se a ação for "aceitar" e não estivermos em chamada
    if (action === 'accept_call' && callDocId && !activeCall) { 
      console.log("Abrindo chamada vinda de notificação:", callDocId);
      
      // 1. Buscar os dados da chamada
      const callRef = doc(db, "calls", callDocId);
      getDoc(callRef).then(callDoc => {
        if (callDoc.exists()) {
          const callData = callDoc.data();
          
          // 2. Buscar os dados de quem ligou
          getDoc(doc(db, "users", callData.callerId)).then(userDoc => {
            if (userDoc.exists()) {
              const callerData = userDoc.data() as User;
              
              // 3. FORÇAR o estado de chamada para 'INCOMING'
              setActiveCall({
                state: CallState.INCOMING,
                type: callData.type,
                withUser: callerData,
                channelName: callData.channelName,
                docId: callDoc.id,
              });
              
              // 4. Limpa a URL
              window.history.replaceState({}, document.title, "/");
            }
          });
        }
      });
    }
  }, [currentUser, activeCall]); // Roda quando o usuário é carregado
  // -------------------------------------------------------------

  // useEffect: OUVINTE DE CHAMADAS 'INCOMING' (continua igual)
  useEffect(() => {
    if (!currentUser) return;
    const callsRef = collection(db, "calls");
    const q = query(callsRef, 
      where("receiverId", "==", currentUser.id),
      where("status", "==", "ringing")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0]; 
        const callData = callDoc.data();
        getDoc(doc(db, "users", callData.callerId)).then(userDoc => {
          if (userDoc.exists()) {
            const callerData = userDoc.data() as User; // Convertido para User
            setActiveCall({
              state: CallState.INCOMING,
              type: callData.type,
              withUser: callerData, // Passa o objeto User completo
              channelName: callData.channelName,
              docId: callDoc.id,
            });
          }
        });
      }
    });
    return () => unsubscribe();
  }, [currentUser]);


  // useEffect: OUVINTE DO ESTADO DA CHAMADA ATIVA (continua igual)
  useEffect(() => {
    if (!activeCall || !activeCall.docId) return;
    const callRef = doc(db, "calls", activeCall.docId);
    const unsubscribe = onSnapshot(callRef, (docSnapshot) => {
      if (!docSnapshot.exists()) {
        console.log("Chamada encerrada pela outra parte.");
        setActiveCall(null);
        return;
      }
      const callData = docSnapshot.data();
      if (callData.status === "active" && activeCall.state === CallState.OUTGOING) {
        console.log("Chamada atendida pelo destinatário!");
        setActiveCall(prev => prev ? { ...prev, state: CallState.ACTIVE } : null);
      }
    });
    return () => unsubscribe();
  }, [activeCall?.docId, activeCall?.state]);

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

  // handleSendMessage (continua igual)
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
        isRead: false,
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem: ", error);
    }
  };
  
  // --- handleStartCall (MODIFICADO) ---
  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!currentUser || !chatWithUser) return;
    const channelName = `call_${currentUser.id}_${chatWithUser.id}`;
    const callsRef = collection(db, "calls");
    
    // 1. Cria o documento da chamada
    const callDocRef = await addDoc(callsRef, {
      callerId: currentUser.id,
      receiverId: chatWithUser.id,
      channelName: channelName,
      type: type === 'audio' ? CallType.AUDIO : CallType.VIDEO,
      status: "ringing",
      createdAt: serverTimestamp(),
    });

    // 2. NOVO: Atualiza o documento com seu próprio ID
    //    Isso é crucial para a Cloud Function encontrar o docId
    await updateDoc(callDocRef, {
      docId: callDocRef.id
    });

    // 3. Define a chamada ativa localmente
    setActiveCall({
      state: CallState.OUTGOING,
      type: type === 'audio' ? CallType.AUDIO : CallType.VIDEO,
      withUser: chatWithUser,
      channelName: channelName,
      docId: callDocRef.id, // Usa o ID do documento
    });
  };
  
  // handleAcceptCall (continua igual)
  const handleAcceptCall = async () => {
    if (!activeCall || !activeCall.docId) return;
    const callRef = doc(db, "calls", activeCall.docId);
    await updateDoc(callRef, {
      status: "active"
    });
    setActiveCall(prev => prev ? { ...prev, state: CallState.ACTIVE } : null);
  };
  
  // handleEndCall (continua igual)
  const handleEndCall = async () => {
    if (!activeCall || !activeCall.docId) return;
    const callRef = doc(db, "calls", activeCall.docId);
    try {
      await deleteDoc(callRef);
    } catch (error) {
      console.error("Erro ao deletar chamada:", error);
    }
    setActiveCall(null);
  };

  if (loadingAuth) {
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="h-dvh w-screen font-sans overflow-hidden">
        {/* Suspense para o CallManager (continua igual) */}
        {activeCall && currentUser && (
          <Suspense fallback={<div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 text-white text-2xl">Carregando chamada...</div>}>
            <CallManager 
              call={activeCall} 
              onAcceptCall={handleAcceptCall} 
              onEndCall={handleEndCall} 
              currentUser={currentUser}
              agoraAppId={AGORA_APP_ID}
            />
          </Suspense>
        )}

        {/* --- LAYOUT PARA CELULAR --- (continua igual) */}
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

        {/* --- LAYTAOUT PARA DESKTOP --- (continua igual) */}
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        <p className="text-2xl">Selecione uma pessoa para conversar</p>
                    </div>
                )}
            </div>
        </div>

    </div>
  );
}
 
export default App;