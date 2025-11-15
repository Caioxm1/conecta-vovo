import React, { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
// --- Imports atualizados ---
import { collection, query, where, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase'; 
// -------------------------

import type { User, Message } from '../types';
import CallHistoryModal from './CallHistoryModal';
import UserRow from './UserRow';

interface FamilyListProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  onLogout: () => void;
}

// --- NOVO COMPONENTE: PAINEL DE ADMIN ---
const AdminPanel: React.FC = () => {
  // 1. Hook para buscar usuários pendentes
  const [pendingSnapshot, loadingPending] = useCollection(
    collection(db, 'pendingUsers')
  );
  
  // 2. Hook para buscar usuários aprovados (para poder removê-los)
  const [usersSnapshot, loadingUsers] = useCollection(
    collection(db, 'users')
  );

  const pendingUsers = pendingSnapshot?.docs.map(doc => doc.data()) || [];
  const approvedUsers = usersSnapshot?.docs.map(doc => doc.data() as User) || [];

  // 3. Função para APROVAR um usuário
  const handleApproveUser = async (pendingUser: any) => {
    if (!confirm(`Aprovar ${pendingUser.name} (${pendingUser.email})?`)) {
      return;
    }
    try {
      // Cria o usuário na coleção 'users'
      const userRef = doc(db, 'users', pendingUser.id);
      await setDoc(userRef, {
        id: pendingUser.id,
        name: pendingUser.name,
        avatar: pendingUser.avatar,
        relationship: 'Família', // Padrão
        status: 'offline',
        lastSeen: serverTimestamp(),
      });

      // Remove o usuário da coleção 'pendingUsers'
      await deleteDoc(doc(db, 'pendingUsers', pendingUser.id));
      alert(`${pendingUser.name} foi aprovado!`);
    } catch (error) {
      console.error("Erro ao aprovar:", error);
      alert("Falha ao aprovar usuário.");
    }
  };

  // 4. Função para REMOVER um usuário
  const handleRemoveUser = async (userToRemove: User) => {
     if (!confirm(`REMOVER ${userToRemove.name} do app? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      // Remove o usuário da coleção 'users'
      await deleteDoc(doc(db, 'users', userToRemove.id));
      alert(`${userToRemove.name} foi removido.`);
    } catch (error) {
      console.error("Erro ao remover:", error);
      alert("Falha ao remover usuário.");
    }
  };


  return (
    <div className="p-4 border border-yellow-500 bg-yellow-50 rounded-lg mb-4">
      <h3 className="text-xl font-bold text-yellow-800 mb-2">Painel de Admin</h3>
      
      {/* Lista de Pendentes */}
      <div className="mb-4">
        <h4 className="font-semibold text-gray-700">Aguardando Aprovação ({pendingUsers.length})</h4>
        {loadingPending && <p>Carregando...</p>}
        <div className="max-h-32 overflow-y-auto">
          {pendingUsers.length === 0 && <p className="text-sm text-gray-500">Ninguém pendente.</p>}
          {pendingUsers.map(user => (
            <div key={user.id} className="flex justify-between items-center p-2 bg-white rounded shadow-sm my-1">
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <button onClick={() => handleApproveUser(user)} className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">
                Aprovar
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Lista de Remover */}
      <div>
        <h4 className="font-semibold text-gray-700">Remover Usuário Aprovado</h4>
        {loadingUsers && <p>Carregando...</p>}
        <div className="max-h-32 overflow-y-auto">
          {approvedUsers.length <= 1 && <p className="text-sm text-gray-500">Nenhum outro usuário para remover.</p>}
          {approvedUsers.map(user => (
            // Não deixa você se remover
            user.id !== auth.currentUser?.uid && (
              <div key={user.id} className="flex justify-between items-center p-2 bg-white rounded shadow-sm my-1">
                <p className="font-semibold">{user.name}</p>
                <button onClick={() => handleRemoveUser(user)} className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">
                  Remover
                </button>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};
// ------------------------------------


const FamilyList: React.FC<FamilyListProps> = ({ currentUser, onSelectUser, onLogout }) => {
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

  // Hook para buscar usuários (sem mudanças)
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('id', '!=', currentUser.id));
  const [usersSnapshot, loadingUsers] = useCollection(q);

  const family: User[] = usersSnapshot?.docs.map(doc => {
    const data = doc.data();
    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      relationship: data.relationship || 'Família',
      status: data.status || 'offline',
      isAdmin: data.isAdmin || false, // Pega o status de admin
    } as User;
  }) || [];

  const callMessages: Message[] = []; 

  return (
    <>
      <CallHistoryModal
        isOpen={isHistoryVisible}
        onClose={() => setIsHistoryVisible(false)}
        calls={callMessages} 
        currentUser={currentUser}
        allUsers={[...family, currentUser]} 
      />
      
      <div className="flex flex-col h-dvh bg-white shadow-lg w-screen md:w-full md:max-w-sm p-6">
        {/* Cabeçalho com nome e botões (sem mudanças) */}
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
        
        {/* --- PAINEL DE ADMIN (NOVO) --- */}
        {/* Mostra o painel de admin SE o usuário logado for admin */}
        {currentUser.isAdmin && <AdminPanel />}
        {/* ----------------------------- */}

        {/* Lista de usuários (sem mudanças) */}
        <div className="space-y-4 flex-grow overflow-y-auto">
          {loadingUsers && <p>Carregando família...</p>}
          {family.map((user) => (
            <UserRow
              key={user.id}
              currentUser={currentUser}
              user={user}
              onSelectUser={onSelectUser}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default FamilyList;