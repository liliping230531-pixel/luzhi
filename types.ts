export enum RecorderState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  REVIEW = 'REVIEW',
}

export interface RecorderSettings {
  showCamera: boolean;
  enableMic: boolean;
  enableSystemAudio: boolean;
  cameraPosition: { x: number; y: number };
}

export interface RecordedMedia {
  blob: Blob;
  url: string;
  duration: number;
  timestamp: number;
}