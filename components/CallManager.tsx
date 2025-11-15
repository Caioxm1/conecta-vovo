import React, { useState, useEffect } from 'react';
import type { User, ActiveCall } from '../types';
import { CallState, CallType } from '../types';

import AgoraRTC from 'agora-rtc-sdk-ng'; 
import {
  AgoraRTCProvider,
  useRTCClient,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  useRemoteUsers,
  LocalVideoTrack,
  RemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-react';

interface CallManagerProps {
  call: ActiveCall;
  onAcceptCall: () => void;
  onEndCall: () => void;
  currentUser: User;
  agoraAppId: string;
}

// Sub-componente (Sem mudanças)
const VideoCall: React.FC<{ 
  channelName: string; 
  callType: CallType;
  localMicTrack: IMicrophoneAudioTrack | null;
  localCamTrack: ICameraVideoTrack | null;
}> = ({ channelName, callType, localMicTrack, localCamTrack }) => {
  const remoteUsers = useRemoteUsers();

  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-2">
      {/* Câmera do Outro Usuário (ocupa a tela inteira) */}
      {remoteUsers.map((user) => (
        <div key={user.uid} className="bg-black rounded-lg overflow-hidden col-span-2 row-span-2">
          <RemoteUser 
            user={user} 
            playVideo={callType === CallType.VIDEO} 
            playAudio={true} 
            className="w-full h-full object-cover" 
          />
        </div>
      ))}
      
      {/* Sua Câmera (janela pequena) */}
      <div className="absolute bottom-4 right-4 w-32 h-48 md:w-48 md:h-64 bg-black rounded-lg overflow-hidden border-2 border-white">
        {callType === CallType.VIDEO ? (
          <LocalVideoTrack track={localCamTrack} play={true} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente Principal (VERSÃO SIMPLIFICADA)
const CallManager: React.FC<CallManagerProps> = ({ call, onAcceptCall, onEndCall, currentUser, agoraAppId }) => {
  const { state, type, withUser, channelName } = call;
  const [callDuration, setCallDuration] = useState(0);
  
  // 1. Estado para controlar se entramos no canal
  const [isJoined, setIsJoined] = useState(false);

  const agoraClient = useRTCClient();

  // --- LÓGICA CORRIGIDA ---
  // 2. Os hooks SÓ SÃO ATIVADOS (1º argumento) quando 'isJoined' for 'true'.
  //    Nós NÃO passamos { publish: false }.
  //    Isso força os hooks a esperar o 'join' e DEPOIS publicar automaticamente.
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(isJoined);
  const { localCameraTrack } = useLocalCameraTrack(isJoined && type === CallType.VIDEO);
  
  // 3. useEffect #1: Lógica de Entrar (Join) e Sair (Leave)
  useEffect(() => {
    // Log de diagnóstico para confirmar o App ID (pode manter)
    console.log("APP ID EM USO:", agoraAppId);
    
    let didJoin = false;

    if (state === CallState.ACTIVE) {
      console.log("useEffect [Join]: Estado é ATIVO. Tentando entrar...");
      agoraClient.join(agoraAppId, channelName, null, currentUser.id)
        .then(() => {
          console.log("useEffect [Join]: SUCESSO. Usuário entrou no canal!");
          didJoin = true;
          // Ativa o 'isJoined'. Isso vai disparar os hooks acima.
          setIsJoined(true); 
        })
        .catch(e => console.error("Falha ao entrar no canal:", e));
    }
    
    // Função de Limpeza
    return () => {
      console.log("useEffect [Join]: Limpeza.");
      setIsJoined(false); // Isso vai desativar e despublicar os hooks acima
      if (didJoin) { 
        agoraClient.leave();
        console.log("useEffect [Join]: Saiu do canal.");
      }
    };
  }, [state, agoraClient, agoraAppId, channelName, currentUser.id]);

  // *** REMOVEMOS os useEffects [Mic] e [Cam] ***
  // A própria biblioteca 'agora-rtc-react' vai cuidar da publicação agora.

  // 4. useEffect #2: Lógica do Timer
  useEffect(() => {
    let timer: number | undefined;
    if (isJoined) {
      timer = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isJoined]);
  
  // O resto do componente (formatDuration, getCallStatusText, e o JSX) continua 100% igual
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
        return isJoined ? formatDuration(callDuration) : "Conectando...";
      default:
        return '';
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-800 bg-opacity-90 flex flex-col items-center justify-center z-50 text-white">
      
      {/* Só renderize o VideoCall DEPOIS que o join estiver completo (isJoined) */}
      {isJoined && (
        <VideoCall 
          channelName={channelName} 
          callType={type}
          localMicTrack={localMicrophoneTrack}
          localCamTrack={localCameraTrack}
        />
      )}
      
      <div className="relative z-10 flex flex-col items-center justify-between h-full w-full p-8">
        <div className="text-center">
            <h2 className="text-5xl font-bold mt-8">{withUser.name}</h2>
            <p className="text-2xl mt-4 opacity-80">{getCallStatusText()}</p>
        </div>

        {(type === CallType.AUDIO || !isJoined) && (
            <div className="flex flex-col items-center">
                <img src={withUser.avatar} alt={withUser.name} className="w-48 h-48 rounded-full border-8 border-white shadow-2xl mb-4" />
            </div>
        )}
        
        <div className="flex items-center space-x-8">
            {state === CallState.INCOMING ? (
                 <>
                    <button onClick={onEndCall} className="flex flex-col items-center justify-center bg-red-500 text-white w-24 h-24 rounded-full hover:bg-red-600 transition-transform transform hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2 2m-2-2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2h2" /></svg>
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


// Componente "Pai" (Sem mudanças)
const AgoraWrapper: React.FC<CallManagerProps> = (props) => {
  const [agoraClient] = useState(() => AgoraRTC.createClient({ codec: "vp8", mode: "rtc" }));

  return (
    <AgoraRTCProvider client={agoraClient}>
      <CallManager {...props} />
    </AgoraRTCProvider>
  );
};

export default AgoraWrapper;