import React, { useState } from 'react';

export const XvRsvpForm: React.FC = () => {
  const [name, setName] = useState('');
  const [guests, setGuests] = useState('1');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-2xl text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mx-auto">
          ✓
        </div>
        <h4 className="text-xl font-serif font-bold text-emerald-900">
          ¡Gracias por confirmar, {name}!
        </h4>
        <p className="text-xs text-emerald-700">
          Tu asistencia para {guests} persona(s) ha sido registrada exitosamente. ¡Nos vemos muy pronto en la fiesta! ✨
        </p>
        <button
          onClick={() => {
            setIsSubmitted(false);
            setName('');
            setGuests('1');
          }}
          className="text-xs font-semibold text-emerald-800 underline pt-2 inline-block hover:text-emerald-950"
        >
          Confirmar otro invitado
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left max-w-md mx-auto">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Nombre completo
        </label>
        <input
          type="text"
          required
          placeholder="Ej. María Fernanda Gómez"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white text-slate-800 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Número de asistentes
        </label>
        <select
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white text-slate-800 text-sm"
        >
          <option value="1">1 Persona</option>
          <option value="2">2 Personas</option>
          <option value="3">3 Personas</option>
          <option value="4">4 Personas</option>
        </select>
      </div>

      <button
        type="submit"
        className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold text-sm shadow-md shadow-pink-500/20 transition-all duration-300"
      >
        Confirmar Asistencia
      </button>
    </form>
  );
};
