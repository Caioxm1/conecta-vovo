import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './firebase';
import { 
  doc, setDoc, serverTimestamp, collection, addDoc, getDoc,
  onSnapshot, 
  updateDoc,
  deleteDoc,
  where,
  query
} from 'firebase/firestore'; 
import { requestPermissionAndSaveToken } from './src/fcm';

import LoginScreen from './components/LoginScreen';
import FamilyList from './components/FamilyList';
import ChatWindow from './components/ChatWindow';
// --- IMPORTAÇÃO NOVA ---
import CameraModal from './components/CameraModal';
// ----------------------
import type { User, Message, ActiveCall } from './types';
import { MessageType, CallState, CallType } from './types';

const AGORA_APP_ID = process.env.AGORA_APP_ID || "";
const CallManager = lazy(() => import('./components/CallManager'));

function App() {
  const [userAuth, loadingAuth] = useAuthState(auth); 
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [chatWithUser, setChatWithUser] = useState<User | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  
  // --- NOVO ESTADO PARA O MODAL DA CÂMERA ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  // ----------------------------------------

  // useEffect de Login (CORRIGIDO)
  useEffect(() => {
    if (userAuth) {
      const userRef = doc(db, 'users', userAuth.uid);
      const pendingRef = doc(db, 'pendingUsers', userAuth.uid);
      
      const checkUserStatus = async () => {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          setCurrentUser(userData);
          setDoc(userRef, { lastSeen: serverTimestamp(), status: 'online' }, { merge: true });
          requestPermissionAndSaveToken(userAuth.uid);
          return;
        }
        
        const pendingSnap = await getDoc(pendingRef);
        if (pendingSnap.exists()) {
          alert("Seu acesso ainda está aguardando aprovação de um administrador. Por favor, tente novamente mais tarde.");
          auth.signOut();
          return;
        }

        await setDoc(pendingRef, {
          id: userAuth.uid,
          name: userAuth.displayName || 'Usuário',
          avatar: userAuth.photoURL || `https://picsum.photos/seed/${userAuth.uid}/200`,
          email: userAuth.email,
          status: 'pending',
          requestedAt: serverTimestamp(),
        });
        alert("Obrigado por se registrar! Seu acesso precisa ser aprovado por um administrador. Por favor, aguarde.");
        auth.signOut();
      };
      checkUserStatus();
    } else {
      setCurrentUser(null);
    }
  }, [userAuth]);

  // useEffect (Deep Link de Notificação de Chamada)
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const callDocId = params.get('callDocId');
    if (action === 'accept_call' && callDocId && !activeCall) { 
      console.log("Abrindo chamada vinda de notificação:", callDocId);
      const callRef = doc(db, "calls", callDocId);
      getDoc(callRef).then(callDoc => {
        if (callDoc.exists()) {
          const callData = callDoc.data();
          getDoc(doc(db, "users", callData.callerId)).then(userDoc => {
            if (userDoc.exists()) {
              const callerData = userDoc.data() as User;
              setActiveCall({
                state: CallState.INCOMING,
                type: callData.type,
                withUser: callerData,
                channelName: callData.channelName,
                docId: callDoc.id,
              });
              window.history.replaceState({}, document.title, "/");
            }
          });
        }
      });
    }
  }, [currentUser, activeCall]);

  // useEffect: OUVINTE DE CHAMADAS 'INCOMING' (sem mudanças)
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
            const callerData = userDoc.data() as User;
            setActiveCall({
              state: CallState.INCOMING,
              type: callData.type,
              withUser: callerData,
              channelName: callData.channelName,
              docId: callDoc.id,
            });
          }
        });
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // useEffect: OUVINTE DO ESTADO DA CHAMADA ATIVA (sem mudanças)
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

  // handleLogout (sem mudanças)
  const handleLogout = () => {
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.id);
      setDoc(userRef, { lastSeen: serverTimestamp(), status: 'offline' }, { merge: true });
    }
    auth.signOut();
    setCurrentUser(null);
    setChatWithUser(null);
  };

  // handleSelectUser (sem mudanças)
  const handleSelectUser = (user: User) => {
    setChatWithUser(user);
  };

  // handleSendMessage (sem mudanças)
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
  
  // handleStartCall (sem mudanças)
  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!currentUser || !chatWithUser) return;
    const channelName = `call_${currentUser.id}_${chatWithUser.id}`;
    const callsRef = collection(db, "calls");
    const callDocRef = await addDoc(callsRef, {
      callerId: currentUser.id,
      receiverId: chatWithUser.id,
      channelName: channelName,
      type: type === 'audio' ? CallType.AUDIO : CallType.VIDEO,
      status: "ringing",
      createdAt: serverTimestamp(),
    });
    await updateDoc(callDocRef, {
      docId: callDocRef.id
    });
    setActiveCall({
      state: CallState.OUTGOING,
      type: type === 'audio' ? CallType.AUDIO : CallType.VIDEO,
      withUser: chatWithUser,
      channelName: channelName,
      docId: callDocRef.id,
    });
  };
  
  // handleAcceptCall (sem mudanças)
  const handleAcceptCall = async () => {
    if (!activeCall || !activeCall.docId) return;
    const callRef = doc(db, "calls", activeCall.docId);
    await updateDoc(callRef, {
      status: "active"
    });
    setActiveCall(prev => prev ? { ...prev, state: CallState.ACTIVE } : null);
  };
  
  // handleEndCall (sem mudanças)
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

  // --- RENDERIZAÇÃO ---
  if (loadingAuth) {
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  // --- RENDERIZAÇÃO DO MODAL DA CÂMERA (NOVO) ---
  if (isCameraOpen && currentUser && chatWithUser) {
    return (
      <CameraModal 
        onClose={() => setIsCameraOpen(false)}
        onSendMessage={handleSendMessage}
        currentUser={currentUser}
        chatWithUser={chatWithUser}
      />
    );
  }
  // ---------------------------------------------

  return (
    <div className="h-dvh w-screen font-sans overflow-hidden">
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
                    onCameraOpen={() => setIsCameraOpen(true)} // <-- Passa a função
                />
            )}
        </div>

        {/* --- LAYTAOUT PARA DESKTOP --- */}
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
                        onCameraOpen={() => setIsCameraOpen(true)} // <-- Passa a função
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