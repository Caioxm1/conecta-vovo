export interface User {
  id: string; // MUDADO DE 'number' PARA 'string'
  name: string;
  avatar: string;
  relationship: string;
  status: 'online' | 'offline';
}

export enum MessageType {
  TEXT = 'text',
  VOICE = 'voice',
  VIDEO_CALL = 'video_call',
  AUDIO_CALL = 'audio_call',
  MISSED_CALL = 'missed_call',
}

export interface Message {
  id: string; // MUDADO DE 'number' PARA 'string'
  senderId: string; // MUDADO DE 'number' PARA 'string'
  receiverId: string; // MUDADO DE 'number' PARA 'string'
  type: MessageType;
  content: string; 
  timestamp: string;
  duration?: number;
}

// O resto (CallState, CallType, ActiveCall) pode continuar igual
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
}