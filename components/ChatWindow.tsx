import React, { useRef, useEffect } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { 
  collection, query, orderBy, Timestamp, getDocs, 
  writeBatch, where, doc, updateDoc 
} from 'firebase/firestore'; 
// --- IMPORTS ATUALIZADOS ---
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuid } from 'uuid';
// ---------------------------

import type { User, Message } from '../types';
import { MessageType } from '../types';
import MessageInput from './MessageInput';

interface ChatWindowProps {
  currentUser: User;
  chatWithUser: User;
  onSendMessage: (type: MessageType, content: string, duration?: number) => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onGoBack: () => void;
  onCameraOpen: () => void;
}

// --- ÍCONE DE STATUS (Preto e Vermelho) ---
const MessageStatusIcon: React.FC<{ isRead: boolean }> = ({ isRead }) => {
  if (isRead) {
    return (
      <svg className="w-5 h-5 inline-block text-red-500" viewBox="0 0 20 20" fill="currentColor">
        <circle cx="6" cy="10" r="2" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 inline-block text-black" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="6" cy="10" r="2" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
};
// ---------------------------------


// O componente MessageBubble
const MessageBubble: React.FC<{ message: Message; isCurrentUser: boolean; sender: User; }> = ({ message, isCurrentUser, sender }) => {
  const alignment = isCurrentUser ? 'justify-end' : 'justify-start';
  const colors = isCurrentUser ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800';
  
  const formatTimestamp = (dateString: string) => {
    if (!dateString) return ''; 
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  
  const renderContent = () => {
    switch (message.type) {
      case MessageType.IMAGE:
        return (
          <img 
            src={message.content} 
            alt="Imagem enviada" 
            className="max-w-xs md:max-w-sm rounded-lg" 
          />
        );
      case MessageType.VOICE:
        return (
          <audio src={message.content} controls className="w-64" />
        );
      case MessageType.MISSED_CALL:
        return (
            <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.707a1 1 0 00-1.414-1.414L10 8.586 7.707 6.293a1 1 0 00-1.414 1.414L8.586 10l-2.293 2.293a1 1 0 101.414 1.414L10 11.414l2.293 2.293a1 1 0 001.414-1.414L11.414 10l2.293-2.293z" clipRule="evenodd" /></svg>
                <span className="font-semibold text-gray-700">Chamada não atendida</span>
            </div>
        );
      case MessageType.AUDIO_CALL:
      case MessageType.VIDEO_CALL:
        return (
          <div className="flex items-center space-x-3">
            {message.type === MessageType.VIDEO_CALL ? (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            )}
            <span className="font-semibold">{message.type === MessageType.VIDEO_CALL ? "Chamada de Vídeo" : "Chamada de Áudio"} - {message.duration}s</span>
          </div>
        );
      default:
        return <p className="text-lg">{message.content}</p>;
    }
  };

  return (
    <div className={`flex items-end gap-3 w-full ${alignment} my-2`}>
        {!isCurrentUser && <img src={sender.avatar} alt={sender.name} className="w-10 h-10 rounded-full" />}
        
        <div className={`p-4 rounded-2xl max-w-lg ${colors} ${isCurrentUser ? 'rounded-br-none' : 'rounded-bl-none'} ${message.type === MessageType.IMAGE ? 'p-1 overflow-hidden' : ''}`}>
          {renderContent()}
          
          {message.type !== MessageType.IMAGE && (
            <div className="flex items-center justify-end space-x-1 mt-2">
              <span className={`text-xs ${isCurrentUser ? 'text-green-200' : 'text-gray-500'}`}>
                {formatTimestamp(message.timestamp)}
              </span>
              {isCurrentUser && (
                <MessageStatusIcon isRead={message.isRead} />
              )}
            </div>
          )}
        </div>
        {isCurrentUser && <img src={sender.avatar} alt={sender.name} className="w-10 h-10 rounded-full" />}
    </div>
  );
};


const ChatWindow: React.FC<ChatWindowProps> = ({ currentUser, chatWithUser, onSendMessage, onStartCall, onGoBack, onCameraOpen }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // --- NOVO REF PARA INPUT DE FUNDO ---
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  // ------------------------------------

  // Busca as mensagens em tempo real
  const chatId = currentUser.id > chatWithUser.id 
    ? `${currentUser.id}_${chatWithUser.id}` 
    : `${chatWithUser.id}_${currentUser.id}`;
  
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  const [messagesSnapshot, loadingMessages] = useCollection(q);

  const messages: Message[] = messagesSnapshot?.docs.map(doc => {
    const data = doc.data();
    const timestamp = (data.timestamp as Timestamp)?.toDate().toISOString(); 
    return {
      id: doc.id,
      ...data,
      timestamp: timestamp,
      isRead: data.isRead || false, 
    } as Message;
  }) || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // useEffect PARA MARCAR COMO LIDO
  useEffect(() => {
    const markMessagesAsRead = async () => {
      const unreadQuery = query(messagesRef,
        where('receiverId', '==', currentUser.id),
        where('isRead', '==', false)
      );
      const querySnapshot = await getDocs(unreadQuery);
      if (querySnapshot.empty) {
        return;
      }
      const batch = writeBatch(db);
      querySnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isRead: true });
      });
      await batch.commit();
      console.log('Mensagens marcadas como lidas!');
    };
    markMessagesAsRead();
  }, [currentUser.id, chatWithUser.id, messagesRef, messagesSnapshot]);
  

  // LÓGICA DE PARENTESCO PRIVADO
  const relationshipLabel = 
    currentUser.relationships?.[chatWithUser.id] || 
    chatWithUser.relationship || 
    'Família';

  const handleEditRelationship = async () => {
    const newRelationship = prompt("Qual o grau de parentesco?", relationshipLabel);
    
    if (newRelationship && newRelationship.trim() !== "") {
      try {
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
          [`relationships.${chatWithUser.id}`]: newRelationship
        });
      } catch (error) {
        console.error("Erro ao atualizar parentesco: ", error);
        alert("Não foi possível atualizar o parentesco.");
      }
    }
  };

  // --- NOVA FUNÇÃO: UPLOAD DO FUNDO ---
  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;
    if (!file.type.startsWith('image/')) {
        alert("Por favor, selecione apenas arquivos de imagem.");
        return;
    }

    alert("Enviando novo plano de fundo..."); // Feedback
    const fileName = `chat-backgrounds/${currentUser.id}/${file.name}`;
    const storageRef = ref(storage, fileName);

    try {
      // 1. Faz o upload
      const snapshot = await uploadBytes(storageRef, file);
      // 2. Pega a URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      // 3. Atualiza o SEU perfil
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        chatBackground: downloadURL
      });
      // O App.tsx vai pegar essa mudança com o onSnapshot e atualizar o app
      
    } catch (error) {
      console.error("Erro ao atualizar plano de fundo:", error);
      alert("Não foi possível atualizar seu plano de fundo.");
    } finally {
      if (event.target) event.target.value = '';
    }
  };
  // ------------------------------------

  return (
    // --- DIV PRINCIPAL MODIFICADA ---
    <div 
      className="flex flex-col h-dvh w-full bg-gray-50 bg-cover bg-center"
      // Adiciona o estilo de fundo dinamicamente
      style={{
        backgroundImage: currentUser.chatBackground ? `url(${currentUser.chatBackground})` : 'none',
        backgroundColor: currentUser.chatBackground ? '' : '#F9FAFB' // bg-gray-50
      }}
    >
    {/* ------------------------------- */}
    
      {/* --- CABEÇALHO ATUALIZADO --- */}
      <header className="flex items-center p-4 bg-white shadow-md z-10">
        <button onClick={onGoBack} className="p-2 rounded-full hover:bg-gray-200 mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img src={chatWithUser.avatar} alt={chatWithUser.name} className="w-14 h-14 rounded-full mr-4" />
        
        <div>
            <h2 className="text-2xl font-bold text-gray-800">{chatWithUser.name}</h2>
            <div className="flex items-center group">
                <p className="text-gray-500">{relationshipLabel}</p>
                <button 
                    onClick={handleEditRelationship}
                    className="ml-2 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-black transition-all"
                    title="Editar parentesco"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
                </button>
            </div>
        </div>
        
        <div className="flex-grow"></div>
        
        {/* --- BOTÕES DO CABEÇALHO ATUALIZADOS --- */}
        <div className="flex items-center space-x-2">
            {/* Botão de trocar fundo (NOVO) */}
            <button 
              onClick={() => backgroundInputRef.current?.click()} 
              className="p-3 rounded-full hover:bg-green-100 transition-colors"
              title="Trocar plano de fundo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1.586-1.586a2 2 0 00-2.828 0L6 14m6-6l.01.01M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
              </svg>
            </button>
            <button onClick={() => onStartCall('audio')} className="p-3 rounded-full hover:bg-green-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </button>
            <button onClick={() => onStartCall('video')} className="p-3 rounded-full hover:bg-green-100 transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
        </div>
        {/* ------------------------------------- */}
      </header>
      
      {/* Área de Mensagens (com 'bg-opacity' para ver o fundo) */}
      <main className="flex-grow p-6 overflow-y-auto bg-black bg-opacity-10">
        {loadingMessages && <p className="text-center">Carregando mensagens...</p>}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isCurrentUser={msg.senderId === currentUser.id} sender={msg.senderId === currentUser.id ? currentUser : chatWithUser} />
        ))}
        <div ref={messagesEndRef} />
      </main>
      
      <MessageInput onSendMessage={onSendMessage} onCameraOpen={onCameraOpen} />

      {/* --- INPUT DE ARQUIVO ESCONDIDO (NOVO) --- */}
      <input
        type="file"
        ref={backgroundInputRef}
        onChange={handleBackgroundUpload}
        className="hidden"
        accept="image/*"
      />
      {/* -------------------------------------- */}
    </div>
  );
};

export default ChatWindow;