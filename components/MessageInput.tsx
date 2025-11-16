import React, { useState, useRef, useEffect } from 'react';
import { MessageType } from '../types';
import { storage } from '../firebase'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuid } from 'uuid'; 

interface MessageInputProps {
  onSendMessage: (type: MessageType, content: string, duration?: number) => void;
  onCameraOpen: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, onCameraOpen }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<null | 'audio' | 'image'>(null); 
  const [recordingTime, setRecordingTime] = useState(0);
  
  const timerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const handleSendText = () => {
    if (text.trim()) {
      onSendMessage(MessageType.TEXT, text.trim());
      setText('');
    }
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
            setUploadStatus('audio');
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            const audioDuration = recordingTime; 

            const fileName = `voice-messages/${uuid()}.wav`;
            const storageRef = ref(storage, fileName);

            try {
              const snapshot = await uploadBytes(storageRef, audioBlob);
              const downloadURL = await getDownloadURL(snapshot.ref);
              onSendMessage(MessageType.VOICE, downloadURL, audioDuration);
            } catch (error) {
              console.error("Erro ao fazer upload do áudio:", error);
              alert("Não foi possível enviar a mensagem de voz.");
            } finally {
              streamRef.current?.getTracks().forEach(track => track.stop());
              streamRef.current = null;
              setUploadStatus(null);
            }
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
    } catch (err) {
        console.error("Error starting recording:", err);
        alert("Não foi possível acessar o microfone. Por favor, verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
        alert("Por favor, selecione apenas arquivos de imagem.");
        return;
    }
    setUploadStatus('image'); 
    const fileName = `images/${uuid()}-${file.name}`;
    const storageRef = ref(storage, fileName);
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      onSendMessage(MessageType.IMAGE, downloadURL);
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error);
      alert("Não foi possível enviar a imagem.");
    } finally {
      setUploadStatus(null);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (uploadStatus) {
    return (
      <div className="p-4 bg-white border-t border-gray-200 text-center">
        <p className="text-xl text-gray-700 animate-pulse">
          {uploadStatus === 'audio' ? 'Enviando áudio...' : 'Enviando imagem...'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      {isRecording ? (
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse mr-3"></div>
                <span className="text-lg font-mono text-gray-700">{formatTime(recordingTime)}</span>
            </div>
          {/* PADDING REDUZIDO de p-3 para p-2 */}
          <button onClick={handleToggleRecording} className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.664V14a1 1 0 001 1h2a1 1 0 001-1V6a1 1 0 00-1-1h-2a1 1 0 00-1 1v2.336L4.555 5.168z" />
             </svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          
          {/* PADDING REDUZIDO de p-3 para p-2 */}
          <button onClick={handleUploadClick} className="p-2 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          {/* PADDING REDUZIDO de p-3 para p-2 */}
          <button 
            onClick={onCameraOpen} 
            className="p-2 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          {/* --- CORREÇÃO PRINCIPAL: min-w-0 adicionado --- */}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="Digite uma mensagem..."
            className="flex-grow min-w-0 p-3 text-lg border-2 border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {/* PADDING REDUZIDO de p-3 para p-2 */}
          <button onClick={handleToggleRecording} className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          {/* PADDING REDUZIDO de p-3 para p-2 */}
          <button onClick={handleSendText} className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      )}
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
};

export default MessageInput;