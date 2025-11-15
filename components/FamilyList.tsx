import React, { useState, useRef } from 'react'; // <-- Adicionado 'useRef'
import { useCollection } from 'react-firebase-hooks/firestore';
// --- Imports atualizados ---
import { 
  collection, query, where, doc, setDoc, deleteDoc, serverTimestamp, updateDoc 
} from 'firebase/firestore';
import { db, auth, storage } from '../firebase'; // <-- Adicionado 'storage'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // <-- Imports novos
// -------------------------

import type { User, Message } from '../types';
import CallHistoryModal from './CallHistoryModal';
import UserRow from './UserRow';

interface FamilyListProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  onLogout: () => void;
}

// --- COMPONENTE: PAINEL DE ADMIN (sem mudanças) ---
const AdminPanel: React.FC = () => {
  const [pendingSnapshot, loadingPending] = useCollection(
    collection(db, 'pendingUsers')
  );
  const [usersSnapshot, loadingUsers] = useCollection(
    collection(db, 'users')
  );

  const pendingUsers = pendingSnapshot?.docs.map(doc => doc.data()) || [];
  const approvedUsers = usersSnapshot?.docs.map(doc => doc.data() as User) || [];

  const handleApproveUser = async (pendingUser: any) => {
    if (!confirm(`Aprovar ${pendingUser.name} (${pendingUser.email})?`)) {
      return;
    }
    try {
      const userRef = doc(db, 'users', pendingUser.id);
      await setDoc(userRef, {
        id: pendingUser.id,
        name: pendingUser.name,
        avatar: pendingUser.avatar,
        relationships: {}, 
        status: 'offline',
        lastSeen: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'pendingUsers', pendingUser.id));
      alert(`${pendingUser.name} foi aprovado!`);
    } catch (error) {
      console.error("Erro ao aprovar:", error);
      alert("Falha ao aprovar usuário.");
    }
  };

  const handleRemoveUser = async (userToRemove: User) => {
     if (!confirm(`REMOVER ${userToRemove.name} do app? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
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
      <div>
        <h4 className="font-semibold text-gray-700">Remover Usuário Aprovado</h4>
        {loadingUsers && <p>Carregando...</p>}
        <div className="max-h-32 overflow-y-auto">
          {approvedUsers.length <= 1 && <p className="text-sm text-gray-500">Nenhum outro usuário para remover.</p>}
          {approvedUsers.map(user => (
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
  
  // --- NOVOS ESTADOS E REF PARA UPLOAD DA FOTO DE PERFIL ---
  const [isUploading, setIsUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  // --------------------------------------------------------

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('id', '!=', currentUser.id));
  const [usersSnapshot, loadingUsers] = useCollection(q);

  const family: User[] = usersSnapshot?.docs.map(doc => {
    const data = doc.data();
    const privateLabel = currentUser.relationships?.[data.id] || 'Família';
    
    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      relationship: privateLabel,
      status: data.status || 'offline',
      isAdmin: data.isAdmin || false,
      relationships: data.relationships || {},
    } as User;
  }) || [];

  const callMessages: Message[] = []; 

  // --- NOVAS FUNÇÕES PARA UPLOAD DA FOTO DE PERFIL ---
  const handleAvatarClick = () => {
    // Abre o seletor de arquivos
    avatarInputRef.current?.click();
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
        alert("Por favor, selecione apenas arquivos de imagem.");
        return;
    }

    setIsUploading(true);
    const fileName = `profile-pictures/${currentUser.id}/${file.name}`;
    const storageRef = ref(storage, fileName);

    try {
      // 1. Faz o upload
      const snapshot = await uploadBytes(storageRef, file);
      // 2. Pega a URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      // 3. Atualiza o perfil do usuário no Firestore
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        avatar: downloadURL
      });
      // (O onSnapshot no App.tsx vai atualizar o currentUser automaticamente)
      
    } catch (error) {
      console.error("Erro ao atualizar foto de perfil:", error);
      alert("Não foi possível atualizar sua foto.");
    } finally {
      setIsUploading(false);
      // Limpa o input
      if (event.target) event.target.value = '';
    }
  };
  // ----------------------------------------------------

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
        {/* --- CABEÇALHO MODIFICADO --- */}
        <div className="flex items-center justify-between mb-8">
          
          {/* Foto de Perfil com Botão de Upload */}
          <div className="flex items-center">
              <div className="relative group">
                <img 
                  src={currentUser.avatar} 
                  alt={currentUser.name} 
                  className={`w-16 h-16 rounded-full mr-4 border-2 border-green-500 ${isUploading ? 'opacity-50' : ''}`}
                />
                {/* Botão de Câmera (overlay) */}
                <button 
                  onClick={handleAvatarClick}
                  disabled={isUploading}
                  className="absolute inset-0 m-auto w-16 h-16 mr-4 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Trocar foto de perfil"
                >
                  {isUploading ? (
                    // Spinner de Carregamento
                    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    // Ícone de Câmera
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>

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
        
        {/* Input de arquivo escondido para a foto de perfil */}
        <input 
          type="file"
          ref={avatarInputRef}
          onChange={handleAvatarUpload}
          className="hidden"
          accept="image/*"
        />
        
        {/* --- PAINEL DE ADMIN --- */}
        {currentUser.isAdmin && <AdminPanel />}

        {/* --- LISTA DE USUÁRIOS --- */}
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