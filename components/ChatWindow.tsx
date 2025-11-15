import React, { useRef, useEffect } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
// ADICIONADO: getDocs, writeBatch, where
import { collection, query, orderBy, Timestamp, getDocs, writeBatch, where } from 'firebase/firestore'; 
import { db } from '../firebase';

import type { User, Message } from '../types';
import { MessageType } from '../types';
import MessageInput from './MessageInput';

interface ChatWindowProps {
  currentUser: User;
  chatWithUser: User;
  onSendMessage: (type: MessageType, content: string, duration?: number) => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onGoBack: () => void;
}

// --- NOVO COMPONENTE DE ÍCONE ---
const MessageStatusIcon: React.FC<{ isRead: boolean }> = ({ isRead }) => {
  // 2 pontos azuis se isRead for true
  if (isRead) {
    return (
      <svg className="w-5 h-5 inline-block text-blue-500" viewBox="0 0 20 20" fill="currentColor">
        <circle cx="6" cy="10" r="2" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    );
  }
  // 2 pontos pretos (cinza) se isRead for false
  return (
    <svg className="w-5 h-5 inline-block text-gray-400" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="6" cy="10" r="2" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
};
// ---------------------------------


// O componente MessageBubble (MODIFICADO)
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
        <div className={`p-4 rounded-2xl max-w-lg ${colors} ${isCurrentUser ? 'rounded-br-none' : 'rounded-bl-none'}`}>
          {renderContent()}
          
          {/* --- MODIFICAÇÃO AQUI --- */}
          <div className="flex items-center justify-end space-x-1 mt-2">
            <span className={`text-xs ${isCurrentUser ? 'text-green-200' : 'text-gray-500'}`}>
              {formatTimestamp(message.timestamp)}
            </span>
            {/* Mostra o ícone de status APENAS para as mensagens do usuário atual */}
            {isCurrentUser && (
              <MessageStatusIcon isRead={message.isRead} />
            )}
          </div>
          {/* ------------------------- */}
        </div>
        {isCurrentUser && <img src={sender.avatar} alt={sender.name} className="w-10 h-10 rounded-full" />}
    </div>
  );
};


const ChatWindow: React.FC<ChatWindowProps> = ({ currentUser, chatWithUser, onSendMessage, onStartCall, onGoBack }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Busca as mensagens em tempo real
  const chatId = currentUser.id > chatWithUser.id 
    ? `${currentUser.id}_${chatWithUser.id}` 
    : `${chatWithUser.id}_${currentUser.id}`;
  
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  const [messagesSnapshot, loadingMessages] = useCollection(q);

  // Converte o snapshot para o nosso tipo Message
  const messages: Message[] = messagesSnapshot?.docs.map(doc => {
    const data = doc.data();
    // Converte o Timestamp do Firestore para string ISO
    const timestamp = (data.timestamp as Timestamp)?.toDate().toISOString(); 
    return {
      id: doc.id,
      ...data,
      timestamp: timestamp,
      // Garante que isRead exista (se não vier do firestore, é false)
      isRead: data.isRead || false, 
    } as Message;
  }) || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]); // Rola para baixo quando as mensagens mudam

  // --- useEffect PARA MARCAR COMO LIDO (MODIFICADO) ---
  useEffect(() => {
    // Função assíncrona para marcar mensagens como lidas
    const markMessagesAsRead = async () => {
      // 1. Encontra todas as mensagens NÃO LIDAS que foram ENVIADAS PARA MIM
      const unreadQuery = query(messagesRef,
        where('receiverId', '==', currentUser.id),
        where('isRead', '==', false)
      );

      const querySnapshot = await getDocs(unreadQuery);
      
      // Se não há mensagens não lidas, não faz nada
      if (querySnapshot.empty) {
        return;
      }

      // 2. Cria um "batch" (lote) para atualizar todas de uma vez
      const batch = writeBatch(db);
      querySnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isRead: true });
      });

      // 3. "Comita" (envia) a atualização para o Firestore
      await batch.commit();
      console.log('Mensagens marcadas como lidas!');
    };

    // Roda a função assim que o chat for aberto
    markMessagesAsRead();

    // Roda de novo se o chatWithUser mudar ou novas mensagens chegarem
  }, [currentUser.id, chatWithUser.id, messagesRef, messagesSnapshot]);
  // ---------------------------------------------

  return (
    <div className="flex flex-col h-dvh bg-gray-50 w-full">
      <header className="flex items-center p-4 bg-white shadow-md z-10">
        <button onClick={onGoBack} className="p-2 rounded-full hover:bg-gray-200 mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img src={chatWithUser.avatar} alt={chatWithUser.name} className="w-14 h-14 rounded-full mr-4" />
        <div>
            <h2 className="text-2xl font-bold text-gray-800">{chatWithUser.name}</h2>
            <p className="text-gray-500">{chatWithUser.relationship}</p>
        </div>
        <div className="flex-grow"></div>
        <div className="flex items-center space-x-2">
            {/* Botões de chamada desabilitados por enquanto */}
            <button onClick={() => onStartCall('audio')} className="p-3 rounded-full hover:bg-green-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </button>
            <button onClick={() => onStartCall('video')} className="p-3 rounded-full hover:bg-green-100 transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
        </div>
      </header>
      <main className="flex-grow p-6 overflow-y-auto">
        {loadingMessages && <p className="text-center">Carregando mensagens...</p>}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isCurrentUser={msg.senderId === currentUser.id} sender={msg.senderId === currentUser.id ? currentUser : chatWithUser} />
        ))}
        <div ref={messagesEndRef} />
      </main>
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
};

export default ChatWindow;