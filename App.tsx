import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
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
import CameraModal from './components/CameraModal';
import type { User, Message, ActiveCall, BeforeInstallPromptEvent } from './types';
import { MessageType, CallState, CallType } from './types';

const AGORA_APP_ID = process.env.AGORA_APP_ID || "";
const CallManager = lazy(() => import('./components/CallManager'));

function App() {
  const [userAuth, loadingAuth] = useAuthState(auth); 
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [chatWithUser, setChatWithUser] = useState<User | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  // useEffect: Ouve o evento de instalação (PWA)
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); 
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      console.log("Evento 'beforeinstallprompt' capturado! O app pode ser instalado.");
    };
    window.addEventListener('beforeinstallprompt' as any, handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt' as any, handleBeforeInstallPrompt);
    };
  }, []);

  // useEffect: Login e Status do Usuário
  useEffect(() => {
    let unsubscribeUser: () => void = () => {}; 
    let tokenRequested = false; 

    if (userAuth) {
      const userRef = doc(db, 'users', userAuth.uid);
      const pendingRef = doc(db, 'pendingUsers', userAuth.uid);
      
      unsubscribeUser = onSnapshot(userRef, (userSnap) => {
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          setCurrentUser(userData);
          if (!tokenRequested) { 
            tokenRequested = true;
            setDoc(userRef, { lastSeen: serverTimestamp(), status: 'online' }, { merge: true });
            requestPermissionAndSaveToken(userAuth.uid);
          }
        } else {
          unsubscribeUser(); 
          checkPendingStatus(userAuth.uid);
        }
      });

      const checkPendingStatus = async (uid: string) => {
        const pendingSnap = await getDoc(pendingRef);
        if (pendingSnap.exists()) {
          alert("Seu acesso ainda está aguardando aprovação de um administrador. Por favor, tente novamente mais tarde.");
          auth.signOut();
        } else {
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
        }
      };
    } else {
      unsubscribeUser();
      setCurrentUser(null);
    }
    return () => unsubscribeUser();
  }, [userAuth]);

  // useEffect: Deep Link de Notificação de Chamada
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const callDocId = params.get('callDocId');
    if (action === 'accept_call' && callDocId && !activeCall) { 
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

  // --- useEffect: OUVINTE DE CHAMADAS 'INCOMING' (COM LÓGICA DE SOM CORRIGIDA) ---
  useEffect(() => {
    if (!currentUser) return;
    const callsRef = collection(db, "calls");
    const q = query(callsRef, 
      where("receiverId", "==", currentUser.id),
      where("status", "==", "ringing")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // CORREÇÃO: Não retorna mais se 'ringtoneRef.current' existir
        if (activeCall) return; 
        
        const callDoc = snapshot.docs[0]; 
        const callData = callDoc.data();
        getDoc(doc(db, "users", callData.callerId)).then(userDoc => {
          if (userDoc.exists()) {
            
            // --- TOCA O SOM DA CHAMADA ---
            // Para o som antigo (se houver) ANTES de tocar o novo
            if (ringtoneRef.current) {
              ringtoneRef.current.pause();
              ringtoneRef.current = null;
            }
            
            try {
              const audio = new Audio('/sounds/ringtone.mp3');
              audio.loop = true;
              ringtoneRef.current = audio;
              
              const playPromise = audio.play();
              
              if (playPromise !== undefined) {
                playPromise.catch(error => {
                  console.warn("Não foi possível tocar o som da chamada: O usuário precisa interagir com a página primeiro.", error);
                });
              }
            } catch (e) {
              console.error("Erro ao tocar som:", e);
            }
            // -----------------------------

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
  }, [currentUser, activeCall]); // Agora 'activeCall' está na dependência correta
  // ----------------------------------------------------

  // useEffect: OUVINTE DO ESTADO DA CHAMADA ATIVA
  useEffect(() => {
    if (!activeCall || !activeCall.docId) return;
    const callRef = doc(db, "calls", activeCall.docId);
    const unsubscribe = onSnapshot(callRef, (docSnapshot) => {
      if (!docSnapshot.exists()) {
        if (ringtoneRef.current) {
          ringtoneRef.current.pause();
          ringtoneRef.current = null;
        }
        setActiveCall(null);
        return;
      }
      const callData = docSnapshot.data();
      if (callData.status === "active" && activeCall.state === CallState.OUTGOING) {
        setActiveCall(prev => prev ? { ...prev, state: CallState.ACTIVE } : null);
      }
    });
    return () => unsubscribe();
  }, [activeCall?.docId, activeCall?.state]);

  // Função: Botão de Instalar (PWA)
  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      alert("Não foi possível instalar o app. Tente novamente mais tarde.");
      return;
    }
    installPromptEvent.prompt(); 
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      console.log('Usuário aceitou a instalação');
      setInstallPromptEvent(null); 
    } else {
      console.log('Usuário recusou a instalação');
    }
  };

  // Função: Logout
  const handleLogout = () => {
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.id);
      setDoc(userRef, { lastSeen: serverTimestamp(), status: 'offline' }, { merge: true });
    }
    auth.signOut();
    setCurrentUser(null);
    setChatWithUser(null);
  };

  // Função: Selecionar Usuário
  const handleSelectUser = (user: User) => {
    setChatWithUser(user);
  };

  // Função: Enviar Mensagem
  const handleSendMessage = async (type: MessageType, content: string, duration?: number) => {
    if (!currentUser || !chatWithUser) return;
    let finalChatUser = chatWithUser;
    
    if (type === MessageType.MISSED_CALL && activeCall) {
      const caller = (activeCall.state === CallState.OUTGOING) ? currentUser : activeCall.withUser;
      const receiver = (activeCall.state === CallState.OUTGOING) ? activeCall.withUser : currentUser;
      finalChatUser = (currentUser.id === caller.id) ? receiver : caller;
    }
    
    const chatId = currentUser.id > finalChatUser.id 
      ? `${currentUser.id}_${finalChatUser.id}` 
      : `${finalChatUser.id}_${currentUser.id}`;
      
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    
    try {
      await addDoc(messagesRef, {
        senderId: (type === MessageType.MISSED_CALL && activeCall) ? activeCall.withUser.id : currentUser.id,
        receiverId: finalChatUser.id,
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
  
  // Função: Iniciar Chamada
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
  
  // Função: Aceitar Chamada
  const handleAcceptCall = async () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    if (!activeCall || !activeCall.docId) return;
    const callRef = doc(db, "calls", activeCall.docId);
    await updateDoc(callRef, {
      status: "active"
    });
    setActiveCall(prev => prev ? { ...prev, state: CallState.ACTIVE } : null);
  };
  
  // Função: Encerrar Chamada (com Chamada Perdida)
  const handleEndCall = async () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    if (!activeCall || !activeCall.docId || !currentUser) return;

    if (activeCall.state === CallState.INCOMING || activeCall.state === CallState.OUTGOING) {
      console.log("Registrando chamada perdida...");
      
      const caller = (activeCall.state === CallState.OUTGOING) ? currentUser : activeCall.withUser;
      const receiver = (activeCall.state === CallState.OUTGOING) ? activeCall.withUser : currentUser;

      const chatId = caller.id > receiver.id 
        ? `${caller.id}_${receiver.id}` 
        : `${receiver.id}_${caller.id}`;
      
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      try {
        await addDoc(messagesRef, {
          senderId: caller.id, 
          receiverId: receiver.id,
          type: MessageType.MISSED_CALL,
          content: `Chamada ${activeCall.type === CallType.VIDEO ? 'de vídeo' : 'de áudio'} não atendida`,
          timestamp: serverTimestamp(),
          isRead: false,
        });
      } catch (error) {
        console.error("Erro ao registrar chamada perdida:", error);
      }
    }

    const callRef = doc(db, "calls", activeCall.docId);
    try {
      await deleteDoc(callRef);
    } catch (error) {
      console.error("Erro ao deletar chamada:", error);
    }
    
    setActiveCall(null);
  };
  // ---------------------------------------------

  // --- RENDERIZAÇÃO ---
  if (loadingAuth) {
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }
  if (!currentUser) {
    return <LoginScreen />;
  }
  if (isCameraOpen && currentUser && chatWithUser) {
    return (
      <Suspense fallback={<div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 text-white text-2xl">Carregando Câmera...</div>}>
        <CameraModal 
          onClose={() => setIsCameraOpen(false)}
          onSendMessage={handleSendMessage}
          currentUser={currentUser}
          chatWithUser={chatWithUser}
        />
      </Suspense>
    );
  }

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

        <div className="h-full w-full md:hidden">
            {!chatWithUser ? (
                <FamilyList
                    currentUser={currentUser}
                    onSelectUser={handleSelectUser}
                    onLogout={handleLogout}
                    onInstallClick={handleInstallClick}
                    installPromptEvent={installPromptEvent}
                />
            ) : (
                <ChatWindow
                    currentUser={currentUser}
                    chatWithUser={chatWithUser}
                    onSendMessage={handleSendMessage}
                    onStartCall={handleStartCall}
                    onGoBack={() => setChatWithUser(null)}
                    onCameraOpen={() => setIsCameraOpen(true)}
                />
            )}
        </div>
        <div className="hidden md:flex h-full w-full">
            <div className="w-auto">
                <FamilyList
                    currentUser={currentUser}
                    onSelectUser={handleSelectUser}
                    onLogout={handleLogout}
                    onInstallClick={handleInstallClick}
                    installPromptEvent={installPromptEvent}
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
                        onCameraOpen={() => setIsCameraOpen(true)}
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