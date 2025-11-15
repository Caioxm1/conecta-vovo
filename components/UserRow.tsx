import React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';

interface UserRowProps {
  currentUser: User;
  user: User; // O usuário desta "linha" (ex: Agatha)
  onSelectUser: (user: User) => void;
}

const UserRow: React.FC<UserRowProps> = ({ currentUser, user, onSelectUser }) => {
  
  // --- LÓGICA PARA CONTAR MENSAGENS NÃO LIDAS ---
  // 1. Calcula o ID do chat
  const chatId = currentUser.id > user.id 
    ? `${currentUser.id}_${user.id}` 
    : `${user.id}_${currentUser.id}`;
    
  // 2. Prepara a query para o Firestore
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const unreadQuery = query(messagesRef, 
    where('receiverId', '==', currentUser.id), // Enviadas para mim
    where('senderId', '==', user.id),        // Por este usuário
    where('isRead', '==', false)             // Que eu não li
  );

  // 3. Usa o 'useCollection' para "ouvir" essa query em tempo real
  const [unreadSnapshot] = useCollection(unreadQuery);

  // 4. A contagem é o 'size' (tamanho) do snapshot
  const unreadCount = unreadSnapshot?.size || 0;
  // ------------------------------------------

  return (
    <button
      onClick={() => onSelectUser(user)}
      className="w-full flex items-center p-4 bg-gray-50 hover:bg-green-100 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-105"
    >
      {/* Contêiner da imagem com a bolinha de notificação */}
      <div className="relative">
        <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full mr-6 border-4 border-white shadow-md" />
        <span className={`absolute bottom-1 right-6 block h-4 w-4 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'} border-2 border-white`}></span>
        
        {/* --- A BOLINHA VERMELHA (BADGE) --- */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white text-sm font-bold">
            {unreadCount > 9 ? '9+' : unreadCount} 
          </span>
        )}
        {/* ---------------------------------- */}

      </div>
      {/* Contêiner do nome */}
      <div>
        <p className="text-2xl font-bold text-gray-800">{user.name}</p>
        <p className="text-lg text-gray-500">{user.relationship}</p>
      </div>
    </button>
  );
};

export default UserRow;