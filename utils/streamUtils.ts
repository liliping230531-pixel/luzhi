/**
 * Merges video from display media and audio from both display and user media.
 */
export const mergeAudioStreams = (
  desktopStream: MediaStream,
  voiceStream: MediaStream | null
): MediaStream => {
  // Create AudioContext (fallback for older browsers)
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass();

  // Ensure context is running (sometimes suspended by autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(e => console.warn("Failed to resume AudioContext:", e));
  }

  const dest = ctx.createMediaStreamDestination();

  // Add desktop audio if available
  if (desktopStream.getAudioTracks().length > 0) {
    try {
      const desktopSource = ctx.createMediaStreamSource(desktopStream);
      desktopSource.connect(dest);
    } catch (e) {
      console.warn("Failed to connect desktop audio:", e);
    }
  }

  // Add microphone audio if available
  if (voiceStream && voiceStream.getAudioTracks().length > 0) {
    try {
      const voiceSource = ctx.createMediaStreamSource(voiceStream);
      voiceSource.connect(dest);
    } catch (e) {
       console.warn("Failed to connect voice audio:", e);
    }
  }

  // Combined tracks: Video from Desktop (Default) + Mixed Audio
  // NOTE: This default video track might be replaced by the canvas stream later
  const tracks = [
    ...desktopStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ];

  return new MediaStream(tracks);
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Composites the camera stream onto the screen stream using a canvas.
 * This allows the camera to be "burned in" to the final video.
 */
export class VideoCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private screenVideo: HTMLVideoElement;
  private cameraVideo: HTMLVideoElement;
  private animationId: number = 0;
  private screenStream: MediaStream;
  private cameraStream: MediaStream;
  private getOverlayPos: () => { x: number, y: number };
  
  constructor(
    screenStream: MediaStream, 
    cameraStream: MediaStream, 
    getOverlayPos: () => { x: number, y: number }
  ) {
    this.screenStream = screenStream;
    this.cameraStream = cameraStream;
    this.getOverlayPos = getOverlayPos;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    
    // Setup hidden video elements to play the streams
    this.screenVideo = document.createElement('video');
    this.screenVideo.muted = true;
    this.screenVideo.srcObject = screenStream;
    this.screenVideo.play().catch(console.error);

    this.cameraVideo = document.createElement('video');
    this.cameraVideo.muted = true;
    this.cameraVideo.srcObject = cameraStream;
    this.cameraVideo.play().catch(console.error);
  }

  start(): MediaStream {
    const draw = () => {
      if (!this.ctx) return;

      const width = this.screenVideo.videoWidth;
      const height = this.screenVideo.videoHeight;

      // Update canvas size if screen resolution changes (or init)
      if (width && height && (this.canvas.width !== width || this.canvas.height !== height)) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      if (width && height) {
        // 1. Draw Screen
        this.ctx.drawImage(this.screenVideo, 0, 0, width, height);

        // 2. Draw Camera Overlay
        // We need to map the DOM position (window coordinates) to Canvas coordinates (video resolution)
        const pos = this.getOverlayPos();
        // Calculate scale factor between window inner size and video resolution
        const scaleX = width / window.innerWidth;
        const scaleY = height / window.innerHeight;
        // Use the larger scale or an average to maintain visibility?
        // Usually video is 1920x1080, window is 1500x900.
        // It's best to use a uniform scale relative to width to keep aspect ratio of camera bubble
        
        // Safety check for 0
        const safeScale = scaleX || 1;

        const bubbleSize = 192 * safeScale; // 48px * 4 (w-48) * scale
        const x = pos.x * scaleX;
        const y = pos.y * scaleY;

        this.ctx.save();
        this.ctx.beginPath();
        // Circular clipping
        this.ctx.arc(x + bubbleSize / 2, y + bubbleSize / 2, bubbleSize / 2, 0, Math.PI * 2);
        this.ctx.clip();
        
        // Draw video (mirrored)
        this.ctx.translate(x + bubbleSize, y);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.cameraVideo, 0, 0, bubbleSize, bubbleSize);
        
        // Restore
        this.ctx.restore();
        
        // Optional: Draw border
        this.ctx.beginPath();
        this.ctx.arc(x + bubbleSize / 2, y + bubbleSize / 2, bubbleSize / 2, 0, Math.PI * 2);
        this.ctx.lineWidth = 4 * safeScale;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.stroke();
      }

      this.animationId = requestAnimationFrame(draw);
    };

    draw();
    
    // Return the stream from canvas
    // 30 FPS is usually sufficient for screencasts and lighter on CPU than 60
    return this.canvas.captureStream(30);
  }

  stop() {
    cancelAnimationFrame(this.animationId);
    this.screenVideo.pause();
    this.screenVideo.srcObject = null;
    this.cameraVideo.pause();
    this.cameraVideo.srcObject = null;
    this.canvas.width = 0; // Release memory
  }
}