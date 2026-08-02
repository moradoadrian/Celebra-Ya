import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const calculateTimeLeft = (): TimeLeft => {
    const difference = +new Date(targetDate) - +new Date();
    if (difference > 0) {
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!isMounted) {
    return (
      <div className="grid grid-cols-4 gap-3 text-center my-6 max-w-sm mx-auto">
        {[
          { label: 'Días', value: 0 },
          { label: 'Horas', value: 0 },
          { label: 'Min', value: 0 },
          { label: 'Seg', value: 0 },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-purple-100 shadow-sm opacity-50"
          >
            <span className="block text-2xl font-extrabold text-purple-700">00</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3 text-center my-6 max-w-sm mx-auto">
      {[
        { label: 'Días', value: timeLeft.days },
        { label: 'Horas', value: timeLeft.hours },
        { label: 'Min', value: timeLeft.minutes },
        { label: 'Seg', value: timeLeft.seconds },
      ].map((item, i) => (
        <div
          key={i}
          className="bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-purple-100 shadow-sm"
        >
          <span className="block text-2xl font-extrabold text-purple-700">
            {String(item.value).padStart(2, '0')}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};
