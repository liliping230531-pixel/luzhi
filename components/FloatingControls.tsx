import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Pause, 
  Play, 
  Square, 
  GripVertical 
} from './Icons';
import { RecorderState, RecorderSettings } from '../types';
import { translations, Language } from '../utils/translations';
import { formatTime } from '../utils/streamUtils';

interface FloatingControlsProps {
  state: RecorderState;
  timer: number;
  settings: RecorderSettings;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  lang: Language;
}

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  state,
  timer,
  settings,
  onToggleMic,
  onToggleCam,
  onPause,
  onResume,
  onStop,
  lang
}) => {
  const t = translations[lang];
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 140, y: window.innerHeight - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Keep within bounds on resize
  useEffect(() => {
    const handleResize = () => {
        setPosition(p => ({
            x: Math.min(Math.max(0, p.x), window.innerWidth - 280),
            y: Math.min(Math.max(0, p.y), window.innerHeight - 80)
        }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      className="fixed z-[90] animate-in zoom-in-95 duration-300"
      style={{ 
        left: position.x, 
        top: position.y,
        touchAction: 'none'
      }}
    >
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-2 flex items-center gap-1.5 select-none ring-1 ring-black/50">
        
        {/* Drag Handle */}
        <div 
          onMouseDown={handleMouseDown}
          className="p-1.5 text-slate-500 hover:text-slate-300 cursor-move rounded-lg hover:bg-white/5 transition-colors"
          title={t.dragToMove}
        >
          <GripVertical size={20} />
        </div>

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Timer Display */}
        <div className="flex items-center gap-2 px-2 min-w-[80px]">
           <div className={`w-2 h-2 rounded-full ${state === RecorderState.PAUSED ? 'bg-yellow-500' : 'bg-red-500 recording-pulse'}`} />
           <span className={`font-mono font-bold text-lg ${state === RecorderState.PAUSED ? 'text-yellow-500' : 'text-white'}`}>
             {formatTime(timer)}
           </span>
        </div>

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Controls */}
        <button 
          onClick={onToggleMic} 
          className={`p-2.5 rounded-xl transition-all ${settings.enableMic ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
          title={t.toggleMic}
        >
          {settings.enableMic ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        
        <button 
          onClick={onToggleCam} 
          className={`p-2.5 rounded-xl transition-all ${settings.showCamera ? 'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
          title={t.toggleCam}
        >
          {settings.showCamera ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <button 
          onClick={state === RecorderState.RECORDING ? onPause : onResume}
          className={`p-2.5 rounded-xl transition-all ${state === RecorderState.PAUSED ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
          title={state === RecorderState.RECORDING ? t.pauseRecording : t.resumeRecording}
        >
          {state === RecorderState.RECORDING ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button 
          onClick={onStop}
          className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 ml-1"
          title={t.stopRecording}
        >
          <Square size={20} fill="currentColor" />
        </button>

      </div>
    </div>
  );
};