import React, { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore'; // Hook para buscar coleções
import { collection, query, where } from 'firebase/firestore';
import { db } from '../firebase'; // Importamos

import type { User, Message } from '../types';
import { MessageType } from '../types';
import CallHistoryModal from './CallHistoryModal';

interface FamilyListProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  onLogout: () => void;
  // Removido: family, allUsers, messages
}

const FamilyList: React.FC<FamilyListProps> = ({ currentUser, onSelectUser, onLogout }) => {
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

  // Hook do react-firebase-hooks para buscar usuários em tempo real
  const usersRef = collection(db, 'users');
  // Busca todos os usuários ONDE o 'id' (uid) não seja o do usuário atual
  const q = query(usersRef, where('id', '!=', currentUser.id));
  const [usersSnapshot, loadingUsers] = useCollection(q);

  // Converte o snapshot do Firebase para o nosso tipo 'User'
  const family: User[] = usersSnapshot?.docs.map(doc => {
    const data = doc.data();
    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      relationship: data.relationship || 'Família',
      status: data.status || 'offline',
    } as User;
  }) || [];

  // O histórico de chamadas também precisa ser refatorado para buscar do Firestore.
  // Por enquanto, vamos passar uma lista vazia para não quebrar.
  const callMessages: Message[] = []; 
  // TODO: Implementar a busca de histórico de chamadas no Firestore

  return (
    <>
      <CallHistoryModal
        isOpen={isHistoryVisible}
        onClose={() => setIsHistoryVisible(false)}
        calls={callMessages} // Passando lista vazia por enquanto
        currentUser={currentUser}
        allUsers={[...family, currentUser]} // Passando todos os usuários
      />
      <div className="flex flex-col h-dvh bg-white shadow-lg w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
              <img src={currentUser.avatar} alt={currentUser.name} className="w-16 h-16 rounded-full mr-4 border-2 border-green-500" />
              <div>
                  <h2 className="text-2xl font-bold text-gray-800">Olá, {currentUser.name.split(' ')[0]}!</h2>
                  <p className="text-gray-500">Com quem você quer falar?</p>
              </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsHistoryVisible(true)} title="Histórico de Chamadas" className="text-gray-500 hover:text-green-500 transition-colors p-2 rounded-full hover:bg-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>
            <button onClick={onLogout} title="Sair" className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Renderiza a lista de usuários buscada do Firestore */}
        <div className="space-y-4 flex-grow overflow-y-auto">
          {loadingUsers && <p>Carregando família...</p>}
          {family.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user)}
              className="w-full flex items-center p-4 bg-gray-50 hover:bg-green-100 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-105"
            >
              <div className="relative">
                <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full mr-6 border-4 border-white shadow-md" />
                <span className={`absolute bottom-1 right-6 block h-4 w-4 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'} border-2 border-white`}></span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{user.name}</p>
                <p className="text-lg text-gray-500">{user.relationship}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default FamilyList;