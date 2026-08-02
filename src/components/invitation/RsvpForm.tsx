import React, { useState } from 'react';

interface RsvpFormProps {
  coupleNames: string;
  whatsappNumber: string;
}

export const RsvpForm: React.FC<RsvpFormProps> = ({ coupleNames, whatsappNumber }) => {
  const [fullName, setFullName] = useState('');
  const [guestsCount, setGuestsCount] = useState('1');
  const [attendance, setAttendance] = useState('yes');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const formattedAttendance = attendance === 'yes' ? '¡Sí asistiré!' : 'Lamentablemente no podré asistir';
    const text = `Hola ${coupleNames}, me comunico a través de su invitación digital.

📌 *Confirmación de Asistencia*
• *Nombre:* ${fullName}
• *Estado:* ${formattedAttendance}
• *Número de pases:* ${guestsCount} persona(s)
${message ? `• *Mensaje para los novios:* ${message}` : ''}

¡Gracias por la invitación! ✨`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-left max-w-lg mx-auto">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
          Nombre completo del invitado / familia
        </label>
        <input
          type="text"
          required
          placeholder="Ej. Familia Valenzuela Morales"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-stone-50/50 text-stone-800 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
            ¿Confirmas asistencia?
          </label>
          <select
            value={attendance}
            onChange={(e) => setAttendance(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-stone-50/50 text-stone-800 text-sm"
          >
            <option value="yes">¡Sí, con mucho gusto!</option>
            <option value="no">No podré asistir</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
            Pases a confirmar
          </label>
          <select
            value={guestsCount}
            onChange={(e) => setGuestsCount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-stone-50/50 text-stone-800 text-sm"
          >
            <option value="1">1 Persona</option>
            <option value="2">2 Personas</option>
            <option value="3">3 Personas</option>
            <option value="4">4 Personas</option>
            <option value="5">5 Personas</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
          Mensaje con buenos deseos (opcional)
        </label>
        <textarea
          rows={3}
          placeholder="¡Les deseamos toda la felicidad del mundo en esta etapa!"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-stone-50/50 text-stone-800 text-sm"
        />
      </div>

      <button
        type="submit"
        className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold text-sm tracking-wide shadow-lg shadow-emerald-600/20 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-1.008 3.678 3.751-.983z" />
        </svg>
        <span>Enviar Confirmación por WhatsApp</span>
      </button>
    </form>
  );
};
