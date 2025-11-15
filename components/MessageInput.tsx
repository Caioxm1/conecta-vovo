import React, { useState, useRef, useEffect } from 'react';
import { MessageType } from '../types';
import { storage } from '../firebase'; // Importamos o Storage
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuid } from 'uuid'; // Para nomes de arquivo únicos

interface MessageInputProps {
  onSendMessage: (type: MessageType, content: string, duration?: number) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // Estado de upload
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null); // Para guardar a stream

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
        streamRef.current = stream; // Guarda a stream
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
            setIsUploading(true); // Começa o upload
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            const audioDuration = recordingTime; // Salva a duração

            // Cria um nome de arquivo único
            const fileName = `voice-messages/${uuid()}.wav`;
            const storageRef = ref(storage, fileName);

            try {
              // 1. Faz o upload do áudio
              const snapshot = await uploadBytes(storageRef, audioBlob);
              // 2. Pega a URL de download
              const downloadURL = await getDownloadURL(snapshot.ref);
              // 3. Envia a URL (e a duração) para o App.tsx
              onSendMessage(MessageType.VOICE, downloadURL, audioDuration);
            } catch (error) {
              console.error("Erro ao fazer upload do áudio:", error);
              alert("Não foi possível enviar a mensagem de voz.");
            } finally {
              // Para o microfone e limpa
              streamRef.current?.getTracks().forEach(track => track.stop());
              streamRef.current = null;
              setIsUploading(false);
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
        mediaRecorderRef.current.stop(); // Isso vai disparar o 'onstop'
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (isUploading) {
    return (
      <div className="p-4 bg-white border-t border-gray-200 text-center">
        <p className="text-xl text-gray-700 animate-pulse">Enviando áudio...</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      {isRecording ? (
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse mr-3"></div>
                {/* TAMANHO DO TEXTO REDUZIDO */}
                <span className="text-lg font-mono text-gray-700">{formatTime(recordingTime)}</span>
            </div>
          {/* PADDING E ÍCONE REDUZIDOS */}
          <button onClick={handleToggleRecording} className="p-3 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.664V14a1 1 0 001 1h2a1 1 0 001-1V6a1 1 0 00-1-1h-2a1 1 0 00-1 1v2.336L4.555 5.168z" />
             </svg>
          </button>
        </div>
      ) : (
        /* ESPAÇAMENTO REDUZIDO */
        <div className="flex items-center space-x-2">
          {/* PADDING E TEXTO REDUZIDOS */}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="Digite uma mensagem..."
            className="flex-grow p-3 text-lg border-2 border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {/* PADDING E ÍCONE REDUZIDOS */}
          <button onClick={handleToggleRecording} className="p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          {/* PADDING E ÍCONE REDUZIDOS */}
          <button onClick={handleSendText} className="p-3 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageInput;