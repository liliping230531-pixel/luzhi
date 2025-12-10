import React, { useEffect, useRef, useState } from 'react';
import { VideoOff } from './Icons';

interface CameraBubbleProps {
  stream: MediaStream | null;
  visible: boolean;
}

export const CameraBubble: React.FC<CameraBubbleProps> = ({ stream, visible }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-50 cursor-move group"
      style={{ 
        left: position.x, 
        top: position.y,
        touchAction: 'none'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl ring-2 ring-indigo-500/50 transition-transform hover:scale-105 active:scale-95 bg-slate-900">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
            <VideoOff size={32} />
          </div>
        )}
        
        {/* Hover overlay indicating draggable */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
      </div>
    </div>
  );
};