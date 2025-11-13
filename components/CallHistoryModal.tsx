import React from 'react';
import type { User, Message } from '../types';
import { MessageType } from '../types';

interface CallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  calls: Message[];
  currentUser: User;
  allUsers: User[];
}

const CallIcon: React.FC<{ type: MessageType }> = ({ type }) => {
    if (type === MessageType.VIDEO_CALL) {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
    }
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>;
};

const CallStatusIcon: React.FC<{ call: Message; currentUserId: number }> = ({ call, currentUserId }) => {
    if (call.type === MessageType.MISSED_CALL) {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l.293.293a1 1 0 001.414-1.414l-3-3z" clipRule="evenodd" /></svg>; // Missed
    }
    if (call.senderId === currentUserId) {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.707a1 1 0 00-1.414-1.414L9 9.586 7.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>; // Outgoing
    }
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" /></svg>; // Incoming
}


const CallHistoryModal: React.FC<CallHistoryModalProps> = ({ isOpen, onClose, calls, currentUser, allUsers }) => {
  if (!isOpen) return null;

  const getCallPartner = (call: Message): User | undefined => {
      const partnerId = call.senderId === currentUser.id ? call.receiverId : call.senderId;
      return allUsers.find(u => u.id === partnerId);
  }

  const getCallStatusText = (call: Message): string => {
    if (call.type === MessageType.MISSED_CALL) return "Chamada perdida";
    if (call.senderId === currentUser.id) return "Realizada";
    return "Recebida";
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <header className="p-6 border-b flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">Histórico de Chamadas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {calls.length > 0 ? (
            <ul className="space-y-4">
              {calls.map(call => {
                const partner = getCallPartner(call);
                if (!partner) return null;

                return (
                  <li key={call.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <img src={partner.avatar} alt={partner.name} className="w-14 h-14 rounded-full mr-4" />
                    <div className="flex-grow">
                      <p className="font-bold text-xl text-gray-800">{partner.name}</p>
                      <div className="flex items-center text-gray-500 space-x-2 mt-1">
                        <CallStatusIcon call={call} currentUserId={currentUser.id} />
                        <span>{getCallStatusText(call)}</span>
                        <span>&middot;</span>
                        <CallIcon type={call.type === MessageType.MISSED_CALL ? MessageType.VIDEO_CALL : call.type} />
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                        <p>{new Date(call.timestamp).toLocaleDateString('pt-BR')}</p>
                        <p>{new Date(call.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-center text-gray-500 py-8">Nenhuma chamada no histórico.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallHistoryModal;
