import React, { useState, useRef, useEffect } from 'react';

export const XvMusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<any>(null);

  // Local MP3 track for XV Años
  const mp3Url = "/music/XV-años.mp3";

  const startSynthWaltz = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      
      let step = 0;
      // Gentle waltz notes (E5, G#5, B5, E6, B5, G#5, etc.)
      const notes = [659.25, 830.61, 987.77, 1318.51, 987.77, 830.61, 659.25, 830.61];

      intervalRef.current = setInterval(() => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[step % notes.length], ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        step++;
      }, 450);
    } catch (e) {
      console.log('Synth error:', e);
    }
  };

  const stopSynthWaltz = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (e) {}
      audioCtxRef.current = null;
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      stopSynthWaltz();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.play().catch(() => {
          // If HTML5 audio fails due to format or CORS, fallback to synth waltz!
          startSynthWaltz();
        });
      } else {
        startSynthWaltz();
      }
    }
  };

  useEffect(() => {
    return () => {
      stopSynthWaltz();
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <audio
        ref={audioRef}
        loop
        preload="auto"
        src={mp3Url}
      />
      <button
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pausar música' : 'Reproducir música'}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 border backdrop-blur-md text-xs font-semibold ${
          isPlaying
            ? 'bg-pink-600 text-white border-pink-400 ring-4 ring-pink-300/40'
            : 'bg-white/95 text-pink-700 border-pink-200 hover:bg-pink-50'
        }`}
      >
        <span className="text-base">{isPlaying ? '🎵' : '🎼'}</span>
        <span>{isPlaying ? 'Música activada' : 'Reproducir música'}</span>
      </button>
    </div>
  );
};
