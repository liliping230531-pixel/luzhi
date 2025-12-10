import React, { useEffect, useRef, useState } from 'react';
import { VideoOff, PictureInPicture2 } from './Icons';

interface CameraBubbleProps {
  stream: MediaStream | null;
  visible: boolean;
  position: { x: number; y: number };
  onPositionChange: (pos: { x: number; y: number }) => void;
}

export const CameraBubble: React.FC<CameraBubbleProps> = ({ stream, visible, position, onPositionChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Basic bounds checking could go here
      onPositionChange({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const togglePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    }
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

  if (!visible) return null;

  return (
    <div
      className="fixed z-[9999] cursor-move group"
      style={{ 
        left: position.x, 
        top: position.y,
        touchAction: 'none'
      }}
      onMouseDown={handleMouseDown}
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
        
        {/* Overlay Controls */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
             {stream && (
               <button 
                 onClick={(e) => { e.stopPropagation(); togglePiP(); }}
                 className="bg-black/50 p-2 rounded-full hover:bg-black/70 text-white transition-all transform hover:scale-110"
                 title="Picture-in-Picture"
                 onMouseDown={e => e.stopPropagation()}
               >
                 <PictureInPicture2 size={20} />
               </button>
             )}
        </div>
      </div>
    </div>
  );
};