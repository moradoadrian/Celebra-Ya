import React, { useState } from 'react';

export const DigitalPassModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 hover:bg-stone-800 text-amber-100 font-serif text-xs uppercase tracking-widest shadow-xl transition-all duration-300 transform hover:scale-105"
      >
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        <span>Ver Mi Pase Digital QR</span>
      </button> */}

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-8 text-center space-y-6 shadow-2xl border border-stone-200 relative overflow-hidden"
          >
            {/* Top decorative badge */}
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-100/60 rounded-full blur-xl" />

            <div className="space-y-1">
              <span className="text-[10px] font-serif uppercase tracking-widest text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Pase de Acceso Exclusivo
              </span>
              <h4 className="text-2xl font-serif font-bold text-stone-900 pt-2">
                Sofía & Alejandro
              </h4>
              <p className="text-xs text-stone-500 font-serif italic">Sábado, 28 de Noviembre de 2026</p>
            </div>

            {/* QR Code Container */}
            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200/70 inline-block shadow-inner">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=BODA-SOFIA-Y-ALEJANDRO-PASE-VIP-2026&color=292524"
                alt="Código QR de Acceso VIP"
                className="w-44 h-44 mx-auto rounded-lg"
              />
              <p className="text-[11px] font-mono text-stone-600 mt-3 font-semibold">
                ID: BODA-SA-2026-VIP
              </p>
            </div>

            <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200/60 text-left space-y-1">
              <p className="text-xs font-semibold text-stone-800">Familia Valenzuela Morales</p>
              <p className="text-xs text-stone-600">Pases asignados: 2 Adultos</p>
              <p className="text-[10px] text-amber-800 font-serif italic">Mesa No. 7 • Jardín Las Palmas</p>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-3 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Cerrar Pase
            </button>
          </div>
        </div>
      )}
    </>
  );
};
