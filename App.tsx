import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './firebase';
import { 
  doc, setDoc, serverTimestamp, collection, addDoc, getDoc,
  onSnapshot, // onSnapshot já estava, mas agora é crucial
  updateDoc,
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

  // useEffect' para ler a URL (Deep Link) (continua igual)
  useEffect(() => {
    if (currentUser && !chatWithUser) {
      // ... (código do 'chatWith' na URL)
    }
  }, [currentUser, chatWithUser]); 

  // useEffect: OUVINTE DE CHAMADAS 'INCOMING' (continua igual)
  // Ouve por chamadas "tocando" para mim
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
            const callerData = userDoc.data();
            
            setActiveCall({
              state: CallState.INCOMING,
              type: callData.type,
              withUser: {
                id: callerData.id,
                name: callerData.name,
                avatar: callerData.avatar,
                relationship: callerData.relationship,
                status: callerData.status,
              },
              channelName: callData.channelName,
              docId: callDoc.id,
            });
          }
        });
      }
    });
    return () => unsubscribe();
  }, [currentUser]);


  // --- NOVO useEffect: OUVINTE DO ESTADO DA CHAMADA ATIVA ---
  // Este useEffect resolve os dois bugs que você encontrou.
  useEffect(() => {
    // Se não há uma chamada ativa, não há o que ouvir.
    if (!activeCall || !activeCall.docId) return;

    const callRef = doc(db, "calls", activeCall.docId);
    
    // Fica "escutando" o documento da chamada
    const unsubscribe = onSnapshot(callRef, (docSnapshot) => {
      
      // BUG 1 CORRIGIDO (Desligar):
      // Se o documento for deletado (pela outra pessoa), encerra a chamada localmente
      if (!docSnapshot.exists()) {
        console.log("Chamada encerrada pela outra parte.");
        setActiveCall(null);
        return;
      }

      const callData = docSnapshot.data();

      // BUG 2 CORRIGIDO (Câmera):
      // Se o status mudar para "active" E nós estávamos "ligando" (OUTGOING),
      // muda nosso estado local para "ACTIVE" também.
      if (callData.status === "active" && activeCall.state === CallState.OUTGOING) {
        console.log("Chamada atendida pelo destinatário!");
        setActiveCall(prev => prev ? { ...prev, state: CallState.ACTIVE } : null);
      }
    });

    // Limpa o ouvinte quando o componente for desmontado ou a chamada mudar
    return () => unsubscribe();
    
  // Re-executa este ouvinte sempre que o 'docId' da chamada mudar ou o 'state' mudar
  }, [activeCall?.docId, activeCall?.state]);
  // -------------------------------------------------------------

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
  
  // handleStartCall (continua igual)
  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!currentUser || !chatWithUser) return;
    const channelName = `call_${currentUser.id}_${chatWithUser.id}`;
    const callsRef = collection(db, "calls");
    const callDoc = await addDoc(callsRef, {
      callerId: currentUser.id,
      receiverId: chatWithUser.id,
      channelName: channelName,
      type: type === 'audio' ? CallType.AUDIO : CallType.VIDEO,
      status: "ringing",
      createdAt: serverTimestamp(),
    });
    setActiveCall({
      state: CallState.OUTGOING,
      type: type === 'audio' ? CallType.AUDIO : CallType.VIDEO,
      withUser: chatWithUser,
      channelName: channelName,
      docId: callDoc.id,
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