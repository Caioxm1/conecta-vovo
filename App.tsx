import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './firebase';
import { 
  doc, setDoc, serverTimestamp, collection, addDoc, getDoc,
  onSnapshot, // <-- ADICIONADO
  updateDoc, // <-- ADICIONADO
  deleteDoc, // <-- ADICIONADO
  where,     // <-- ADICIONADO
  query      // <-- ADICIONADO
} from 'firebase/firestore'; 
import { requestPermissionAndSaveToken } from './src/fcm';

import LoginScreen from './components/LoginScreen';
import FamilyList from './components/FamilyList';
import ChatWindow from './components/ChatWindow';
import CallManager from './components/CallManager'; // <-- MUDOU DE CallUI
import type { User, Message, ActiveCall } from './types';
import { MessageType, CallState, CallType } from './types';

// Pega o App ID do Agora do arquivo .env
const AGORA_APP_ID = process.env.AGORA_APP_ID || "";

// A função 'showNotification' pode continuar a mesma
// ... (showNotification)

function App() {
  const [userAuth, loadingAuth] = useAuthState(auth); 
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [chatWithUser, setChatWithUser] = useState<User | null>(null);
  // O 'activeCall' agora guarda mais informações
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  // useEffect que cuida do login e perfil (continua igual)
  useEffect(() => {
    // ... (código de login, setDoc, requestPermissionAndSaveToken)
  }, [userAuth]);

  // useEffect' para ler a URL (Deep Link) (continua igual)
  useEffect(() => {
    // ... (código de 'chatWith' na URL)
  }, [currentUser, chatWithUser]); 

  // --- NOVO useEffect: OUVINTE DE CHAMADAS ---
  useEffect(() => {
    if (!currentUser) return;

    // Ouve a coleção 'calls'
    const callsRef = collection(db, "calls");
    
    // Query: Onde eu sou o destinatário (receiverId) E o status é 'ringing'
    const q = query(callsRef, 
      where("receiverId", "==", currentUser.id),
      where("status", "==", "ringing")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Se alguma chamada aparecer
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0]; // Pega a primeira chamada
        const callData = callDoc.data();
        
        // Busca os dados do 'caller' (quem está ligando)
        getDoc(doc(db, "users", callData.callerId)).then(userDoc => {
          if (userDoc.exists()) {
            const callerData = userDoc.data();
            // Toca um som de chamada
            // new Audio('/path/to/ringtone.mp3').play();
            
            // Define a chamada como ATIVA (INCOMING) no estado do React
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
              docId: callDoc.id, // Guarda o ID do documento da chamada
            });
          }
        });
      }
    });

    return () => unsubscribe(); // Limpa o ouvinte
  }, [currentUser]);
  // ------------------------------------------

  // ... (handleLogout, handleSelectUser - continuam iguais)

  // --- handleSendMessage (AJUSTADO) ---
  const handleSendMessage = async (type: MessageType, content: string, duration?: number) => {
    // ... (código de 'chatId', 'messagesRef' - continua igual)
    try {
      await addDoc(messagesRef, {
        // ... (dados da mensagem - continua igual)
        isRead: false,
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem: ", error);
    }
  };
  
  // --- handleStartCall (AJUSTADO) ---
  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!currentUser || !chatWithUser) return;

    // 1. Cria um nome de canal único
    const channelName = `call_${currentUser.id}_${chatWithUser.id}`;
    
    // 2. Cria o documento da chamada no Firestore
    const callsRef = collection(db, "calls");
    const callDoc = await addDoc(callsRef, {
      callerId: currentUser.id,
      receiverId: chatWithUser.id,
      channelName: channelName,
      type: type === 'audio' ? CallType.AUDIO : CallType.VIDEO,
      status: "ringing", // A chamada está "tocando"
      createdAt: serverTimestamp(),
    });

    // 3. Define a chamada como ATIVA (OUTGOING) no estado do React
    setActiveCall({
      state: CallState.OUTGOING,
      type: type === 'audio' ? CallType.AUDIO : CallType.VIDEO,
      withUser: chatWithUser,
      channelName: channelName,
      docId: callDoc.id, // Guarda o ID do documento
    });
  };
  
  // --- handleAcceptCall (AJUSTADO) ---
  const handleAcceptCall = async () => {
    if (!activeCall || !activeCall.docId) return;

    // 1. Atualiza o documento da chamada no Firestore para 'active'
    const callRef = doc(db, "calls", activeCall.docId);
    await updateDoc(callRef, {
      status: "active"
    });

    // 2. Define o estado local como ATIVO
    setActiveCall(prev => prev ? { ...prev, state: CallState.ACTIVE } : null);
  };
  
  // --- handleEndCall (AJUSTADO) ---
  const handleEndCall = async () => {
    if (!activeCall || !activeCall.docId) return;

    // 1. Deleta o documento da chamada no Firestore
    const callRef = doc(db, "calls", activeCall.docId);
    try {
      await deleteDoc(callRef);
    } catch (error) {
      console.error("Erro ao deletar chamada:", error);
    }

    // 2. Limpa o estado local
    setActiveCall(null);
  };

  // ... (if loadingAuth, if !currentUser - continuam iguais)

  return (
    <div className="h-dvh w-screen font-sans overflow-hidden">
        {/* --- MODIFICADO: Usa o CallManager e passa o App ID --- */}
        {activeCall && currentUser && (
          <CallManager 
            call={activeCall} 
            onAcceptCall={handleAcceptCall} 
            onEndCall={handleEndCall} 
            currentUser={currentUser}
            agoraAppId={AGORA_APP_ID}
          />
        )}

        {/* --- LAYOUT PARA CELULAR --- */}
        <div className="h-full w-full md:hidden">
            {/* ... (renderização condicional de FamilyList ou ChatWindow - continua igual) */}
        </div>

        {/* --- LAYOUT PARA DESKTOP --- */}
        <div className="hidden md:flex h-full w-full">
            {/* ... (renderização de FamilyList e ChatWindow/Placeholder - continua igual) */}
        </div>

    </div>
  );
}
 
export default App;