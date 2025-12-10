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

  // Combined tracks: Video from Desktop + Mixed Audio
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