import React, { useState, useRef, useEffect } from 'react';
import { 
  Monitor, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Circle, 
  Square,
  Languages,
  Download,
  Check,
  Pause,
  Play
} from './components/Icons';
import { RecorderState, RecorderSettings } from './types';
import { CameraBubble } from './components/CameraBubble';
import { FloatingControls } from './components/FloatingControls';
import { mergeAudioStreams, formatTime } from './utils/streamUtils';
import { translations, Language } from './utils/translations';

const App: React.FC = () => {
  const [state, setState] = useState<RecorderState>(RecorderState.IDLE);
  const [settings, setSettings] = useState<RecorderSettings>({
    showCamera: true,
    enableMic: true,
    enableSystemAudio: true,
  });
  const [lang, setLang] = useState<Language>('zh');
  
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false); // New state for selection guide

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null); // Main recording stream
  const writableStreamRef = useRef<any>(null); // FileSystemWritableFileStream

  const t = translations[lang];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
    };
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const stopAllStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 320, facingMode: 'user' },
        audio: false 
      });
      setCameraStream(stream);
    } catch (err) {
      console.warn("Camera access denied or cancelled:", err);
      setSettings(prev => ({ ...prev, showCamera: false }));
    }
  };

  const toggleCamera = async () => {
    if (settings.showCamera) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        setCameraStream(null);
      }
      setSettings(prev => ({ ...prev, showCamera: false }));
    } else {
      await initializeCamera();
      setSettings(prev => ({ ...prev, showCamera: true }));
    }
  };

  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm'; // Fallback
  };

  const startTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setTimer(t => t + 1);
    }, 1000);
  };

  const startRecording = async () => {
    setError(null);
    writableStreamRef.current = null;
    chunksRef.current = [];
    setIsSelecting(true); // Show guide

    let displayStream: MediaStream | null = null;

    try {
      // 1. Get Screen Stream (This prompts the user to select Area/Window/Screen)
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: settings.enableSystemAudio
      });
      
      setIsSelecting(false); // Hide guide on success

      // Handle user stopping via browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      // 2. Setup File Handle (Ask for save path)
      let useDirectSave = false;
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
             suggestedName: `Recording_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`,
             types: [{
                 description: 'WebM Video',
                 accept: {'video/webm': ['.webm']},
             }],
          });
          writableStreamRef.current = await handle.createWritable();
          useDirectSave = true;
        } catch (e: any) {
           if (e.name === 'AbortError') {
               console.log("Save dialog cancelled by user.");
               displayStream.getTracks().forEach(t => t.stop());
               return; 
           }
           console.warn("Direct save not available:", e);
           useDirectSave = false;
        }
      }

      // 3. Get Mic Stream if enabled
      let micStream: MediaStream | null = null;
      if (settings.enableMic) {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
        } catch (e) {
            console.warn("Mic permission failed, proceeding without mic", e);
        }
      }

      // 4. Merge Audio (System + Mic)
      const combinedStream = mergeAudioStreams(displayStream, micStream);
      streamRef.current = combinedStream;

      // 5. Setup Recorder
      const selectedMimeType = getSupportedMimeType();
      
      if (!combinedStream.active) {
         console.warn("Stream inactive before start (user stopped sharing?)");
         return;
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMimeType
      });
      
      recorder.onerror = (event: any) => {
        console.error("MediaRecorder error:", event);
        setError("Recording error occurred.");
        stopRecording();
      };

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
           if (writableStreamRef.current) {
             try {
               await writableStreamRef.current.write(e.data);
             } catch (writeErr) {
               console.error("Write error:", writeErr);
               chunksRef.current.push(e.data);
             }
           } else {
             chunksRef.current.push(e.data);
           }
        }
      };

      recorder.onstop = async () => {
        try {
            if (writableStreamRef.current) {
                await writableStreamRef.current.close();
                writableStreamRef.current = null;
                setNotification(t.saveSuccess);
            } else if (chunksRef.current.length > 0) {
                const blob = new Blob(chunksRef.current, { type: selectedMimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Recording_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setNotification(t.saveSuccess);
            }
        } catch (err) {
            console.error("Error saving file:", err);
             if (chunksRef.current.length > 0) {
                 const blob = new Blob(chunksRef.current, { type: selectedMimeType });
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = `Backup_Recording_${Date.now()}.webm`;
                 a.click();
             }
        }
        
        setState(RecorderState.IDLE);
        stopAllStreams();
        setTimer(0);
        setIsSelecting(false);
      };

      recorder.start(1000); // Collect chunks every second
      mediaRecorderRef.current = recorder;
      
      // Start Timer
      setTimer(0);
      startTimer();

      setState(RecorderState.RECORDING);

      // If camera is enabled but not initialized, try init
      if (settings.showCamera && !cameraStream) {
        await initializeCamera();
      }

    } catch (err: any) {
      if (displayStream) {
          (displayStream as MediaStream).getTracks().forEach(t => t.stop());
      }
      setIsSelecting(false); // Hide guide on error

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || 
          err.message?.includes('Permission denied') || err.message?.includes('user denied')) {
        console.log("Recording cancelled by user");
        return; 
      }
      
      console.error("Error starting recording:", err);
      setError(t.errorGeneric);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && state === RecorderState.RECORDING) {
      mediaRecorderRef.current.pause();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setState(RecorderState.PAUSED);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && state === RecorderState.PAUSED) {
      mediaRecorderRef.current.resume();
      startTimer();
      setState(RecorderState.RECORDING);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (state === RecorderState.RECORDING || state === RecorderState.PAUSED)) {
      if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    } else {
        stopAllStreams();
        setState(RecorderState.IDLE);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30 font-sans">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px]" />
      </div>

      {/* Persistent Camera Bubble */}
      <CameraBubble 
        stream={cameraStream} 
        visible={settings.showCamera} 
      />

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
           <div className="bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-medium">
              <Check size={18} />
              {notification}
           </div>
        </div>
      )}

      {/* Selection Guide Overlay */}
      {isSelecting && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
           <div className="max-w-md w-full p-8 bg-slate-950 border border-indigo-500/30 rounded-2xl shadow-2xl text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
              <div className="relative z-10">
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-600/30">
                     <Monitor size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">{t.selectionGuideTitle}</h3>
                  <div className="text-left bg-slate-900/50 p-4 rounded-xl space-y-3 mb-6 border border-slate-800">
                     <p className="text-indigo-300 font-medium">{t.selectionGuideStep1}</p>
                     <p className="text-slate-300">{t.selectionGuideStep2}</p>
                     <div className="text-xs text-slate-500 pt-2 border-t border-slate-800/50 mt-2">
                         {t.selectionGuideNote}
                     </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                      {t.waitingSelection}
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* Main Container */}
      <div className={`relative z-10 transition-all duration-500 ${state === RecorderState.IDLE && !isSelecting ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
        
        {/* Navigation */}
        <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Circle size={20} fill="currentColor" className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">{t.appTitle}</span>
          </div>

          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              <Languages size={18} />
              <span className="text-sm font-medium uppercase">{lang}</span>
            </button>
            <div className="absolute right-0 top-full mt-2 w-32 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden hidden group-hover:block z-50">
               <button 
                  onClick={() => setLang('zh')} 
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-800 transition-colors ${lang === 'zh' ? 'text-indigo-400 font-medium' : 'text-slate-300'}`}
                >
                  中文 (ZH)
                </button>
                <button 
                  onClick={() => setLang('en')} 
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-800 transition-colors ${lang === 'en' ? 'text-indigo-400 font-medium' : 'text-slate-300'}`}
                >
                  English (EN)
                </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="max-w-4xl mx-auto mt-20 px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-slate-200 to-slate-500 mb-6 whitespace-pre-line">
            {t.heroTitle}
          </h1>
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            {t.heroDesc}
          </p>

          {/* Quick Settings Card */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-2 rounded-2xl inline-flex flex-col md:flex-row gap-4 items-center shadow-2xl">
            <div className="flex items-center gap-2 px-4">
              <button 
                onClick={() => setSettings(s => ({...s, enableMic: !s.enableMic}))}
                className={`p-3 rounded-xl transition-all ${settings.enableMic ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title={t.toggleMic}
              >
                {settings.enableMic ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              
              <button 
                onClick={toggleCamera}
                className={`p-3 rounded-xl transition-all ${settings.showCamera ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title={t.toggleCam}
              >
                {settings.showCamera ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <div className="w-px h-8 bg-slate-800 mx-2" />
            </div>

            <button 
              onClick={startRecording}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-medium px-8 py-4 rounded-xl shadow-lg shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <div className="w-3 h-3 rounded-full bg-red-400 animate-pulse" />
              {t.startRecording}
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg inline-block">
                {error}
            </div>
          )}

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
             {[
                { title: t.selectArea, desc: t.selectAreaDesc, icon: <Monitor className="text-indigo-400" /> },
                { title: t.camOverlay, desc: t.camOverlayDesc, icon: <Circle className="text-pink-400" /> },
                { title: t.instantShare, desc: t.instantShareDesc, icon: <Download className="text-cyan-400" /> },
             ].map((feature, i) => (
                <div key={i} className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <div className="mb-4">{feature.icon}</div>
                    <h3 className="font-semibold text-lg text-white mb-2">{feature.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
                </div>
             ))}
          </div>

        </main>
      </div>

      {/* Floating Control Widget (Visible during Recording and Pause) */}
      {(state === RecorderState.RECORDING || state === RecorderState.PAUSED) && (
        <FloatingControls 
          state={state}
          timer={timer}
          settings={settings}
          lang={lang}
          onToggleMic={() => setSettings(s => ({...s, enableMic: !s.enableMic}))}
          onToggleCam={toggleCamera}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
        />
      )}

    </div>
  );
};

export default App;