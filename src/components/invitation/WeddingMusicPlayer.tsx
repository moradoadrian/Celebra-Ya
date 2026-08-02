import React, { useState, useRef, useEffect } from 'react';

export const WeddingMusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<any>(null);

  // Local MP3 track for Wedding Demo
  const mp3Url = "/music/boda.mp3";

  const startSynthPiano = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      let step = 0;
      // Romantic canon melody frequencies
      const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 587.33, 698.46];

      intervalRef.current = setInterval(() => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[step % notes.length], ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
        step++;
      }, 500);
    } catch (e) {
      console.log('Synth error:', e);
    }
  };

  const stopSynthPiano = () => {
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
      stopSynthPiano();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.play().catch(() => {
          startSynthPiano();
        });
      } else {
        startSynthPiano();
      }
    }
  };

  useEffect(() => {
    return () => {
      stopSynthPiano();
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <audio
        ref={audioRef}
        loop
        preload="auto"
        src={mp3Url}
      />
      <button
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pausar Música' : 'Reproducir Música de Fondo'}
        className={`flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl transition-all duration-500 transform hover:scale-105 border backdrop-blur-md ${
          isPlaying
            ? 'bg-rose-950/80 text-rose-100 border-rose-400/40 ring-4 ring-rose-500/20'
            : 'bg-white/90 text-slate-800 border-slate-200 hover:bg-white'
        }`}
      >
        <div className="relative flex items-center justify-center w-6 h-6">
          {isPlaying ? (
            <div className="flex items-end justify-center gap-0.5 w-full h-4">
              <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_100ms] h-full" />
              <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_300ms] h-3" />
              <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_200ms] h-4" />
              <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_400ms] h-2" />
            </div>
          ) : (
            <svg className="w-5 h-5 text-rose-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          )}
        </div>
        <span className="text-xs font-serif font-medium tracking-wide">
          {isPlaying ? 'Música activada 🎵' : 'Música de fondo 🎵'}
        </span>
      </button>
    </div>
  );
};
