export interface User {
  id: string;
  name: string;
  avatar: string;
  relationship: string;
  status: 'online' | 'offline';
  isAdmin?: boolean; 
}

export enum MessageType {
  TEXT = 'text',
  VOICE = 'voice',
  IMAGE = 'image', // <-- ARQUIVO ATUALIZADO AQUI
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