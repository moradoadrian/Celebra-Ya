import React, { useState, useRef } from 'react';

export const WeddingMusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.log('Audio autoplay prevented:', err);
      });
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Hidden audio element with royalty free romantic wedding piano track */}
      <audio
        ref={audioRef}
        loop
        src="https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=wedding-piano-112199.mp3"
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
