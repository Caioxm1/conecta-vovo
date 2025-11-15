import React, { useState, useEffect, useRef } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuid } from 'uuid';
import type { User, Message } from '../types';
import { MessageType } from '../types';

// Imports do Agora
import AgoraRTC, { 
  ICameraVideoTrack, 
  IDevice 
} from 'agora-rtc-sdk-ng'; 
import {
  AgoraRTCProvider,
  useRTCClient,
  LocalVideoTrack,
} from 'agora-rtc-react';

interface CameraModalProps {
  onClose: () => void;
  onSendMessage: (type: MessageType, content: string, duration?: number) => void;
  currentUser: User;
  chatWithUser: User;
}

// Componente interno que lida com a lógica da câmera
const CameraView: React.FC<CameraModalProps> = ({ onClose, onSendMessage, currentUser, chatWithUser }) => {
  const [localCamTrack, setLocalCamTrack] = useState<ICameraVideoTrack | null>(null);
  const [videoDevices, setVideoDevices] = useState<IDevice[]>([]);
  const [currentCamIndex, setCurrentCamIndex] = useState(0);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null); // Guarda a foto tirada
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- FUNÇÃO SEPARADA PARA CRIAR/REINICIAR A CÂMERA ---
  const createCamera = async () => {
    try {
      console.log("CameraModal: Criando trilha de câmera...");
      const camTrack = await AgoraRTC.createCameraVideoTrack();
      setLocalCamTrack(camTrack);
      
      const devices = await AgoraRTC.getCameras();
      console.log("Câmeras disponíveis:", devices);
      setVideoDevices(devices);
      
      // --- CORREÇÃO AQUI ---
      // Era: camTrack.getTrack().getSettings().deviceId
      // Correto: camTrack.getMediaStreamTrack().getSettings().deviceId
      const currentDeviceId = camTrack.getMediaStreamTrack().getSettings().deviceId;
      // ---------------------
      
      const currentIndex = devices.findIndex(device => device.deviceId === currentDeviceId);
      if (currentIndex !== -1) {
        setCurrentCamIndex(currentIndex);
      }
      return camTrack; // Retorna a trilha criada
    } catch (error) {
      console.error("Falha ao criar câmera:", error);
      alert("Não foi possível acessar a câmera. Verifique as permissões.");
      onClose(); // Fecha o modal se falhar
      return null;
    }
  };
  
  // --- useEffect #1: Ligar a câmera ao abrir o modal ---
  useEffect(() => {
    let camTrack: ICameraVideoTrack | null = null;
    
    createCamera().then(track => {
      camTrack = track; // Guarda a referência da trilha
    });

    // Função de Limpeza
    return () => {
      console.log("CameraModal: Limpando...");
      if (camTrack) {
        camTrack.stop();
        camTrack.close();
      }
      setLocalCamTrack(null);
    };
  }, []); // Array vazio roda só 1 vez
  // --------------------------------------------------------

  // Função para trocar de câmera (lógica do CallManager)
  const handleFlipCamera = async () => {
    if (!localCamTrack || videoDevices.length < 2) return;
    try {
      const nextIndex = (currentCamIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];
      console.log(`Trocando para câmera: ${nextDevice.label}`);
      await localCamTrack.setDevice(nextDevice.deviceId);
      setCurrentCamIndex(nextIndex);
    } catch (error) {
      console.error("Falha ao trocar de câmera:", error);
    }
  };

  // Função para BATER A FOTO
  const handleTakePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !localCamTrack) return;
    const videoElement = videoRef.current.querySelector('video');
    if (!videoElement) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg');
    setPhotoDataUrl(dataUrl);
    
    // Para a câmera
    if (localCamTrack) {
      localCamTrack.stop();
      localCamTrack.close();
      setLocalCamTrack(null);
    }
  };

  // Função para ENVIAR A FOTO
  const handleSendPhoto = async () => {
    if (!photoDataUrl) return;
    setIsUploading(true);
    const fileName = `photos/${uuid()}.jpg`;
    const storageRef = ref(storage, fileName);

    try {
      const snapshot = await uploadString(storageRef, photoDataUrl, 'data_url');
      const downloadURL = await getDownloadURL(snapshot.ref);
      onSendMessage(MessageType.IMAGE, downloadURL);
      console.log("Foto enviada!");
      onClose();
    } catch (error) {
      console.error("Erro ao enviar foto:", error);
      alert("Não foi possível enviar a foto.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- FUNÇÃO "TIRAR OUTRA" CORRIGIDA ---
  const handleRetakePhoto = () => {
    setPhotoDataUrl(null); // Volta para a tela da câmera
    createCamera(); // Recria a câmera
  };
  // ---------------------------------------

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Tela de Prévia da Câmera */}
      {!photoDataUrl && (
        <>
          <div ref={videoRef} className="w-full h-full">
            {localCamTrack && (
              <LocalVideoTrack 
                track={localCamTrack} 
                play={true} 
                className="w-full h-full object-cover"
              />
            )}
          </div>
          {/* Botões de Controle da Câmera */}
          <div className="absolute bottom-10 left-0 right-0 flex justify-around items-center">
            <button 
              onClick={onClose} 
              className="text-white text-lg p-2"
            >
              Cancelar
            </button>
            <button 
              onClick={handleTakePhoto} 
              className="w-20 h-20 bg-white rounded-full border-4 border-gray-400 p-1"
            >
              <div className="w-full h-full bg-white rounded-full border-2 border-black"></div>
            </button>
            <button 
              onClick={handleFlipCamera} 
              disabled={videoDevices.length < 2}
              className="p-4 bg-gray-500 bg-opacity-70 text-white rounded-full disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Tela de Confirmação (Depois de tirar a foto) */}
      {photoDataUrl && (
        <>
          <img src={photoDataUrl} alt="Prévia" className="w-full h-full object-contain" />
          {/* Botões de Confirmação */}
          <div className="absolute bottom-10 left-0 right-0 flex justify-around items-center">
            <button 
              onClick={handleRetakePhoto} 
              className="text-white text-lg p-2"
            >
              Tirar Outra
            </button>
            <button 
              onClick={handleSendPhoto} 
              disabled={isUploading}
              className="p-4 bg-green-500 text-white rounded-full"
            >
              {isUploading ? "Enviando..." : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </div>
        </>
      )}

      {/* Canvas escondido para "bater" a foto */}
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
};

// Componente "Pai" que fornece o Cliente Agora
const CameraModal: React.FC<CameraModalProps> = (props) => {
  // Criamos um cliente SÓ para este modal
  const [agoraClient] = useState(() => AgoraRTC.createClient({ codec: "vp8", mode: "rtc" }));

  return (
    <AgoraRTCProvider client={agoraClient}>
      <CameraView {...props} />
    </AgoraRTCProvider>
  );
};

export default CameraModal;