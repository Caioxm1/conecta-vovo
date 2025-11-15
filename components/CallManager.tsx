import React, { useState, useEffect } from 'react';
import type { User, ActiveCall } from '../types';
import { CallState, CallType } from '../types';

// Importamos o AgoraRTC para usar manualmente
import AgoraRTC, { 
  IAgoraRTCRemoteUser, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack,
  IDevice // <-- IMPORTAÇÃO NOVA
} from 'agora-rtc-sdk-ng'; 

import {
  AgoraRTCProvider,
  useRTCClient,
  useRemoteUsers,
  LocalVideoTrack,
  RemoteUser,
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
      {/* Câmera do Outro Usuário */}
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

// Componente Principal (LÓGICA MANUAL DE JOIN E PUBLISH)
const CallManager: React.FC<CallManagerProps> = ({ call, onAcceptCall, onEndCall, currentUser, agoraAppId }) => {
  const { state, type, withUser, channelName } = call;
  const [callDuration, setCallDuration] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  
  const [localMicTrack, setLocalMicTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localCamTrack, setLocalCamTrack] = useState<ICameraVideoTrack | null>(null);

  // --- NOVOS ESTADOS PARA TROCAR DE CÂMERA ---
  const [videoDevices, setVideoDevices] = useState<IDevice[]>([]);
  const [currentCamIndex, setCurrentCamIndex] = useState(0);
  // ------------------------------------------
  
  const agoraClient = useRTCClient();

  // useEffect #1: Lógica de Entrar (Join) e Sair (Leave)
  useEffect(() => {
    let micTrack: IMicrophoneAudioTrack | null = null;
    let camTrack: ICameraVideoTrack | null = null;
    let didJoin = false;

    const joinAndPublish = async () => {
      try {
        console.log("useEffect [Join]: Estado é ATIVO. Tentando entrar...");
        await agoraClient.join(agoraAppId, channelName, null, currentUser.id);
        didJoin = true;
        console.log("useEffect [Join]: SUCESSO. Usuário entrou no canal!");
        
        // 1. Criar Microfone
        console.log("useEffect [Mic]: Criando microfone...");
        micTrack = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalMicTrack(micTrack);
        
        // 2. Criar Câmera (se for video)
        if (type === CallType.VIDEO) {
          console.log("useEffect [Cam]: Criando câmera...");
          camTrack = await AgoraRTC.createCameraVideoTrack();
          setLocalCamTrack(camTrack);
        }

        // 3. Publicar TUDO de uma vez
        const tracksToPublish: (IMicrophoneAudioTrack | ICameraVideoTrack)[] = [];
        if (micTrack) tracksToPublish.push(micTrack);
        if (camTrack) tracksToPublish.push(camTrack);
        
        if (tracksToPublish.length > 0) {
          console.log("useEffect [Publish]: Publicando trilhas...", tracksToPublish);
          await agoraClient.publish(tracksToPublish);
          console.log("useEffect [Publish]: TRILHAS PUBLICADAS COM SUCESSO!");
        }
        
        setIsJoined(true); 

      } catch (e) {
        console.error("ERRO CRÍTICO no join/publish:", e);
      }
    };

    if (state === CallState.ACTIVE) {
      joinAndPublish();
    }
    
    // Função de Limpeza (executa quando a chamada termina)
    return () => {
      console.log("useEffect [Join]: Limpeza.");
      setIsJoined(false);
      
      if (micTrack) {
        micTrack.stop();
        micTrack.close();
      }
      if (camTrack) {
        camTrack.stop();
        camTrack.close();
      }
      setLocalMicTrack(null);
      setLocalCamTrack(null);
      
      if (didJoin) { 
        agoraClient.unpublish();
        agoraClient.leave();
        console.log("useEffect [Join]: Saiu do canal e limpou mídias.");
      }
    };
  }, [state, agoraClient, agoraAppId, channelName, currentUser.id, type]);

  // --- NOVO useEffect #2: Carregar Lista de Câmeras ---
  useEffect(() => {
    // Roda APENAS se a câmera foi criada
    if (localCamTrack) {
      AgoraRTC.getCameras().then(devices => {
        console.log("Câmeras disponíveis:", devices);
        setVideoDevices(devices); // Salva a lista de câmeras
        
        // Encontra o ID da câmera atual e define o índice
        const currentDeviceId = localCamTrack.getTrack().getSettings().deviceId;
        const currentIndex = devices.findIndex(device => device.deviceId === currentDeviceId);
        if (currentIndex !== -1) {
          setCurrentCamIndex(currentIndex);
        }
      });
    }
  }, [localCamTrack]); // Roda quando 'localCamTrack' é criado
  // ----------------------------------------------------

  // useEffect #3: Lógica do Timer
  useEffect(() => {
    let timer: number | undefined;
    if (isJoined) {
      timer = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isJoined]);
  
  // --- NOVA FUNÇÃO: Trocar de Câmera ---
  const handleFlipCamera = async () => {
    if (!localCamTrack || videoDevices.length < 2) {
      console.log("Troca de câmera falhou: trilha não existe ou só há 1 câmera.");
      return; // Não faz nada se não houver trilha ou se só tiver 1 câmera
    }

    try {
      // Calcula o índice da PRÓXIMA câmera na lista
      const nextIndex = (currentCamIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];

      console.log(`Trocando para câmera: ${nextDevice.label} (ID: ${nextDevice.deviceId})`);
      
      // Manda o Agora trocar o dispositivo
      await localCamTrack.setDevice(nextDevice.deviceId);
      
      // Atualiza o índice da câmera atual no estado
      setCurrentCamIndex(nextIndex);
      
    } catch (error) {
      console.error("Falha ao trocar de câmera:", error);
      alert("Não foi possível trocar de câmera.");
    }
  };
  // ---------------------------------------

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
      
      {isJoined && (
        <VideoCall 
          channelName={channelName} 
          callType={type}
          localMicTrack={localMicTrack}
          localCamTrack={localCamTrack}
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
        
        {/* --- ÁREA DOS BOTÕES (MODIFICADA) --- */}
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
                <>
                  {/* BOTÃO DE VIRAR A CÂMERA (NOVO) */}
                  {/* Só aparece se for vídeo, se tiver entrado e se houver mais de 1 câmera */}
                  {type === CallType.VIDEO && isJoined && videoDevices.length > 1 && (
                    <button 
                      onClick={handleFlipCamera} 
                      className="flex flex-col items-center justify-center bg-gray-500 bg-opacity-70 text-white w-20 h-20 rounded-full hover:bg-opacity-100 transition-all transform hover:scale-110"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15" />
                      </svg>
                      <span className="mt-1 text-xs font-semibold">Virar</span>
                    </button>
                  )}

                  <button onClick={onEndCall} className="flex flex-col items-center justify-center bg-red-500 text-white w-24 h-24 rounded-full hover:bg-red-600 transition-transform transform hover:scale-110">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2 2m-2-2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2h2" /></svg>
                      <span className="mt-1 text-sm font-semibold">Desligar</span>
                  </button>
                </>
            )}
        </div>
        {/* ----------------------------------- */}

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