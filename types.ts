export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  isAdmin?: boolean; 
  relationship?: string;
  relationships?: { [key: string]: string };
  chatBackground?: string;
}

export enum MessageType {
  TEXT = 'text',
  VOICE = 'voice',
  IMAGE = 'image',
  VIDEO_CALL = 'video_call',
  AUDIO_CALL = 'audio_call',
  MISSED_CALL = 'missed_call',
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  type: MessageType;
  content: string; 
  timestamp: string;
  duration?: number;
  isRead: boolean;
}

export enum CallState {
  NONE,
  OUTGOING,
  INCOMING,
  ACTIVE,
}

export enum CallType {
  AUDIO,
  VIDEO,
}

export interface ActiveCall {
  state: CallState;
  type: CallType;
  withUser: User;
  docId?: string;
  channelName?: string;
}

// --- INTERFACE NOVA ADICIONADA ---
// Define o tipo para o evento de instalação do PWA
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}
// ---------------------------------