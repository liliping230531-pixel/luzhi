import React, { useState, useRef, useEffect } from 'react';
import { Download, Trash2, Share2, Play, Pause, Scissors, Check, X, RotateCcw } from './Icons';
import { RecordedMedia } from '../types';
import { GeminiTitle } from './GeminiTitle';
import { translations, Language } from '../utils/translations';
import { formatTime } from '../utils/streamUtils';

interface PreviewProps {
  media: RecordedMedia;
  onDiscard: () => void;
  onUpdateMedia: (media: RecordedMedia) => void;
  lang: Language;
}

export const Preview: React.FC<PreviewProps> = ({ media, onDiscard, onUpdateMedia, lang }) => {
  const t = translations[lang];
  const [title, setTitle] = useState(`${t.defaultTitle} ${new Date(media.timestamp).toLocaleString()}`);
  const [desc, setDesc] = useState(t.noDesc);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Initialize trim points when duration is available
  useEffect(() => {
    if (videoRef.current && media) {
        // Reset when media changes
        videoRef.current.currentTime = 0;
        setCurrentTime(0);
        setIsEditing(false);
    }
  }, [media]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
        let dur = videoRef.current.duration;
        
        // Robust duration check: Chrome MediaRecorder often returns Infinity for webm blobs.
        // If Infinity or NaN, fallback to the recorded media duration (calculated from timer).
        if (!Number.isFinite(dur) || dur === 0) {
            dur = media.duration / 1000;
        }

        setDuration(dur);
        setTrimStart(0);
        setTrimEnd(dur);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);
        
        // Loop logic for trim mode
        if (isEditing) {
            if (time >= trimEnd) {
                videoRef.current.pause();
                videoRef.current.currentTime = trimStart;
                setIsPlaying(false);
            }
        }
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = media.url;
    a.download = `${title.replace(/\s+/g, '_')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        if (isEditing && videoRef.current.currentTime >= trimEnd) {
             videoRef.current.currentTime = trimStart;
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const enterEditMode = () => {
      if(videoRef.current) videoRef.current.pause();
      setIsPlaying(false);
      setIsEditing(true);
  };

  const cancelEdit = () => {
      setIsEditing(false);
      if(videoRef.current) {
          setTrimStart(0);
          setTrimEnd(duration);
      }
  };

  // Logic to re-record the trimmed section
  const saveTrim = async () => {
      const video = videoRef.current;
      if (!video) return;

      setIsProcessing(true);
      setIsPlaying(true); // UI feedback
      
      try {
          // Prepare for recording
          video.currentTime = trimStart;
          await new Promise(r => { video.onseeked = r; }); // Wait for seek
          
          // Use captureStream to record what is being played
          const stream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
          const recorder = new MediaRecorder(stream, { mimeType: media.blob.type }); // Use same mime type
          const chunks: Blob[] = [];
          
          recorder.ondataavailable = e => { if(e.data.size > 0) chunks.push(e.data); };
          
          recorder.onstop = () => {
              const newBlob = new Blob(chunks, { type: media.blob.type });
              const newUrl = URL.createObjectURL(newBlob);
              const newDuration = (trimEnd - trimStart) * 1000;
              
              onUpdateMedia({
                  ...media,
                  blob: newBlob,
                  url: newUrl,
                  duration: newDuration,
                  timestamp: Date.now()
              });
              setIsProcessing(false);
              setIsEditing(false);
              setIsPlaying(false);
          };

          // Start
          recorder.start();
          video.play();
          
          // Stop logic
          const stopHandler = () => {
              if (video.currentTime >= trimEnd) {
                  video.pause();
                  recorder.stop();
                  video.removeEventListener('timeupdate', stopHandler);
              }
          };
          video.addEventListener('timeupdate', stopHandler);

      } catch (e) {
          console.error("Trim failed", e);
          setIsProcessing(false);
      }
  };

  // Slider Logic
  const handleDrag = (type: 'start' | 'end') => (e: React.MouseEvent | React.TouchEvent) => {
      const track = e.currentTarget.parentElement;
      if (!track) return;
      
      const update = (clientX: number) => {
          const rect = track.getBoundingClientRect();
          const percent = Math.min(Math.max(0, (clientX - rect.left) / rect.width), 1);
          const time = percent * duration;
          
          if (type === 'start') {
              const newStart = Math.min(time, trimEnd - 0.5); // Min 0.5s segment
              setTrimStart(newStart);
              if (videoRef.current) videoRef.current.currentTime = newStart;
          } else {
              const newEnd = Math.max(time, trimStart + 0.5);
              setTrimEnd(newEnd);
              if (videoRef.current) videoRef.current.currentTime = newEnd;
          }
      };

      const mouseMove = (ev: MouseEvent) => {
          ev.preventDefault();
          update(ev.clientX);
      };
      const mouseUp = () => {
          document.removeEventListener('mousemove', mouseMove);
          document.removeEventListener('mouseup', mouseUp);
      };
      
      const touchMove = (ev: TouchEvent) => {
         update(ev.touches[0].clientX);
      };
      const touchEnd = () => {
         document.removeEventListener('touchmove', touchMove);
         document.removeEventListener('touchend', touchEnd);
      }

      if ('touches' in e) {
           document.addEventListener('touchmove', touchMove, { passive: false });
           document.addEventListener('touchend', touchEnd);
      } else {
          document.addEventListener('mousemove', mouseMove);
          document.addEventListener('mouseup', mouseUp);
      }
  };


  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-5xl flex flex-col gap-6 h-full max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
             <h2 className="text-2xl font-bold text-white tracking-tight">{t.previewTitle}</h2>
             <p className="text-slate-400 text-sm">{t.previewSubtitle}</p>
          </div>
          <div className="flex items-center gap-3">
             {!isEditing ? (
                 <>
                    <button 
                    onClick={onDiscard}
                    className="px-4 py-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"
                    >
                    <Trash2 size={18} />
                    {t.discard}
                    </button>
                    
                    <button 
                    onClick={enterEditMode}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                    <Scissors size={18} />
                    {t.edit}
                    </button>

                    <button 
                    onClick={handleDownload}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                    <Download size={18} />
                    {t.exportVideo}
                    </button>
                 </>
             ) : (
                <>
                     <button 
                        onClick={cancelEdit}
                        disabled={isProcessing}
                        className="px-4 py-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                        <X size={18} />
                        {t.cancelTrim}
                    </button>
                    <button 
                        onClick={saveTrim}
                        disabled={isProcessing}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isProcessing ? (
                            <>
                             <RotateCcw size={18} className="animate-spin" />
                             {t.processing}
                            </>
                        ) : (
                            <>
                             <Check size={18} />
                             {t.saveTrim}
                            </>
                        )}
                    </button>
                </>
             )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          
          {/* Video Player Column */}
          <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 relative group flex-1 flex flex-col">
                <video 
                ref={videoRef}
                src={media.url} 
                className="w-full h-full object-contain bg-slate-900"
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                controls={false}
                playsInline
                />
                
                {/* Custom Controls Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {!isPlaying && !isProcessing && (
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl pointer-events-auto cursor-pointer hover:scale-110 transition-transform" onClick={togglePlay}>
                            <Play size={32} fill="white" className="text-white ml-1" />
                        </div>
                    )}
                    {isProcessing && (
                        <div className="bg-black/50 backdrop-blur-sm px-6 py-4 rounded-xl flex items-center gap-3">
                            <RotateCcw className="animate-spin text-indigo-400" />
                            <span className="text-white font-medium">{t.processing}</span>
                        </div>
                    )}
                </div>

                {/* Progress Bar for Non-Editing Mode */}
                {!isEditing && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="pointer-events-auto flex items-center gap-4">
                            <button onClick={togglePlay} className="text-white hover:text-indigo-400">
                                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                            </button>
                            <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden relative cursor-pointer" onClick={(e) => {
                                if(videoRef.current) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const percent = (e.clientX - rect.left) / rect.width;
                                    videoRef.current.currentTime = percent * duration;
                                }
                            }}>
                                <div className="absolute top-0 left-0 bottom-0 bg-indigo-500" style={{ width: `${(currentTime / duration) * 100}%` }} />
                            </div>
                            <span className="text-xs font-mono text-slate-300">{formatTime(currentTime)} / {formatTime(duration)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Editing Controls */}
            {isEditing && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-in slide-in-from-top-2">
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                        <span>{formatTime(trimStart)}</span>
                        <span className="text-indigo-400 font-medium">{t.trimHelp}</span>
                        <span>{formatTime(trimEnd)}</span>
                    </div>
                    
                    {/* Timeline Slider */}
                    <div className="relative h-12 select-none touch-none group">
                        {/* Background Track */}
                        <div className="absolute top-1/2 left-0 right-0 h-2 bg-slate-800 rounded-full -translate-y-1/2" />
                        
                        {/* Selected Range */}
                        <div 
                            className="absolute top-1/2 h-2 bg-indigo-600 rounded-full -translate-y-1/2"
                            style={{ 
                                left: `${(trimStart / duration) * 100}%`,
                                right: `${100 - (trimEnd / duration) * 100}%`
                            }}
                        />

                        {/* Start Handle */}
                        <div 
                            onMouseDown={handleDrag('start')}
                            onTouchStart={handleDrag('start')}
                            className="absolute top-1/2 w-6 h-10 bg-white rounded-lg shadow-xl cursor-ew-resize border-2 border-slate-200 hover:border-indigo-500 hover:scale-110 transition-transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10"
                            style={{ left: `${(trimStart / duration) * 100}%` }}
                        >
                            <div className="w-1 h-4 bg-slate-300 rounded-full" />
                        </div>

                         {/* End Handle */}
                         <div 
                            onMouseDown={handleDrag('end')}
                            onTouchStart={handleDrag('end')}
                            className="absolute top-1/2 w-6 h-10 bg-white rounded-lg shadow-xl cursor-ew-resize border-2 border-slate-200 hover:border-indigo-500 hover:scale-110 transition-transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10"
                            style={{ left: `${(trimEnd / duration) * 100}%` }}
                        >
                            <div className="w-1 h-4 bg-slate-300 rounded-full" />
                        </div>
                        
                        {/* Playhead for reference */}
                        <div 
                           className="absolute top-1 h-10 w-0.5 bg-red-500 pointer-events-none -translate-y-1 z-0 opacity-50"
                           style={{ left: `${(currentTime / duration) * 100}%` }}
                        />
                    </div>
                </div>
            )}
          </div>

          {/* Details Column */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col gap-6 overflow-y-auto">
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.titleLabel}</label>
                <input 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.descLabel}</label>
                <textarea 
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* AI Generator Integration */}
            <GeminiTitle 
                lang={lang}
                onTitleGenerated={(t, d) => {
                    setTitle(t);
                    setDesc(d);
                }} 
            />

            <div className="mt-auto pt-6 border-t border-slate-800">
               <div className="flex justify-between text-sm text-slate-400">
                  <span>{t.duration}</span>
                  <span className="font-mono text-white">{Math.round(media.duration / 1000)}s</span>
               </div>
               <div className="flex justify-between text-sm text-slate-400 mt-2">
                  <span>{t.size}</span>
                  <span className="font-mono text-white">{(media.blob.size / (1024 * 1024)).toFixed(2)} MB</span>
               </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};