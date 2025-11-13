import React, { useState, useEffect } from 'react';
import type { User, ActiveCall } from '../types';
import { CallState, CallType } from '../types';

interface CallUIProps {
  call: ActiveCall;
  onAcceptCall: () => void;
  onEndCall: () => void;
  currentUser: User;
}

const CallUI: React.FC<CallUIProps> = ({ call, onAcceptCall, onEndCall, currentUser }) => {
  const { state, type, withUser } = call;
  const [callDuration, setCallDuration] = useState(0);
  
  useEffect(() => {
    let timer: number | undefined;
    if (state === CallState.ACTIVE) {
      timer = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [state]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const getCallStatusText = () => {
    switch (state) {
      case CallState.OUTGOING:
        return `Chamando ${withUser.name}...`;
      case CallState.INCOMING:
        return `${withUser.name} está te ligando...`;
      case CallState.ACTIVE:
        return formatDuration(callDuration);
      default:
        return '';
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-800 bg-opacity-90 flex flex-col items-center justify-center z-50 text-white">
      {type === CallType.VIDEO && state === CallState.ACTIVE && (
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-2">
            <div className="bg-black rounded-lg overflow-hidden col-span-2 row-span-2 md:col-span-1 md:row-span-2">
                 <img src="https://picsum.photos/seed/you/800/600" className="w-full h-full object-cover" alt="Sua Câmera"/>
                 <p className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md">{currentUser.name} (Você)</p>
            </div>
            <div className="bg-black rounded-lg overflow-hidden col-span-2 row-span-2 md:col-span-1 md:row-span-2">
                 <img src={`https://picsum.photos/seed/${withUser.id}/800/600`} className="w-full h-full object-cover" alt="Câmera do outro usuário"/>
                 <p className="absolute bottom-2 right-2 bg-black bg-opacity-50 px-2 py-1 rounded-md">{withUser.name}</p>
            </div>
        </div>
      )}
      
      <div className="relative z-10 flex flex-col items-center justify-between h-full w-full p-8">
        <div className="text-center">
            <h2 className="text-5xl font-bold mt-8">{withUser.name}</h2>
            <p className="text-2xl mt-4 opacity-80">{getCallStatusText()}</p>
        </div>

        {type === CallType.AUDIO && (
            <div className="flex flex-col items-center">
                <img src={withUser.avatar} alt={withUser.name} className="w-48 h-48 rounded-full border-8 border-white shadow-2xl mb-4" />
            </div>
        )}
        
        <div className="flex items-center space-x-8">
            {state === CallState.INCOMING ? (
                 <>
                    <button onClick={onEndCall} className="flex flex-col items-center justify-center bg-red-500 text-white w-24 h-24 rounded-full hover:bg-red-600 transition-transform transform hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        <span className="mt-1 text-sm font-semibold">Recusar</span>
                    </button>
                    <button onClick={onAcceptCall} className="flex flex-col items-center justify-center bg-green-500 text-white w-24 h-24 rounded-full hover:bg-green-600 transition-transform transform hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        <span className="mt-1 text-sm font-semibold">Aceitar</span>
                    </button>
                 </>
            ) : (
                <button onClick={onEndCall} className="flex flex-col items-center justify-center bg-red-500 text-white w-24 h-24 rounded-full hover:bg-red-600 transition-transform transform hover:scale-110">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2 2m-2-2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2h2" /></svg>
                    <span className="mt-1 text-sm font-semibold">Desligar</span>
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default CallUI;
