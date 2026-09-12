import React, { useState } from 'react';
import type { InvitadoItem } from '@/types';

interface DigitalPassRsvpProps {
  eventoId: number;
  invitado: InvitadoItem;
  coupleNames: string;
}

export const DigitalPassRsvp: React.FC<DigitalPassRsvpProps> = ({
  eventoId,
  invitado,
  coupleNames,
}) => {
  // Estado local sincronizado con el invitado
  const initialConfirmado =
    invitado.confirmado === true || invitado.confirmado === 'true'
      ? true
      : invitado.confirmado === false || invitado.confirmado === 'false'
      ? false
      : null;

  const initialPasesConfirmados =
    invitado.pases_confirmados != null
      ? Number(invitado.pases_confirmados)
      : initialConfirmado === true
      ? Number(invitado.numero_pases) || 1
      : 0;

  const [confirmado, setConfirmado] = useState<boolean | null>(initialConfirmado);
  const [pasesConfirmados, setPasesConfirmados] = useState<number>(initialPasesConfirmados);
  const [selectedAttendance, setSelectedAttendance] = useState<'yes' | 'no' | null>(
    initialConfirmado === true ? 'yes' : initialConfirmado === false ? 'no' : null
  );
  const [selectedPases, setSelectedPases] = useState<number>(
    initialPasesConfirmados > 0 ? initialPasesConfirmados : Number(invitado.numero_pases) || 1
  );
  const [isEditing, setIsEditing] = useState<boolean>(initialConfirmado === null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const maxPases = Math.max(1, Number(invitado.numero_pases) || 1);

  // Array para el selector de pases (1 .. maxPases)
  const pasesOptions = Array.from({ length: maxPases }, (_, i) => i + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (selectedAttendance === null) {
      setErrorMessage('Por favor selecciona si nos acompañarás o si no podrás asistir.');
      return;
    }

    const isAttending = selectedAttendance === 'yes';
    const finalPases = isAttending ? selectedPases : 0;

    // Validación en capa de cliente
    if (isAttending) {
      if (finalPases <= 0) {
        setErrorMessage('Debes seleccionar al menos 1 persona para confirmar tu asistencia.');
        return;
      }
      if (finalPases > maxPases) {
        setErrorMessage(`No puedes confirmar más de ${maxPases} pases asignados.`);
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: invitado.codigo,
          evento_id: eventoId,
          confirmado: isAttending,
          pases_confirmados: finalPases,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setErrorMessage(result.error || 'Ocurrió un error al guardar tu confirmación.');
      } else {
        setConfirmado(isAttending);
        setPasesConfirmados(finalPases);
        setIsEditing(false);
        setSuccessMessage(result.message || 'Confirmación registrada correctamente.');
      }
    } catch (err) {
      console.error('[DigitalPassRsvp Error]', err);
      setErrorMessage('Error de conexión. Por favor verifica tu internet e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 text-left">
      
      {/* TARJETA DEL PASE DIGITAL */}
      <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-linear-to-b from-stone-50 via-white to-stone-50 shadow-md">
        
        {/* Decoración superior con estética dorada/ámbar */}
        <div className="h-2.5 bg-linear-to-r from-amber-300 via-amber-500 to-amber-300" />

        <div className="p-6 sm:p-8 space-y-6">
          
          {/* ENCABEZADO DEL PASE */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
                Pase Digital de Acceso
              </span>
              <h3 className="text-xl sm:text-2xl font-serif-luxury font-bold text-stone-900 mt-2">
                {invitado.nombre}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Invitación para {coupleNames}
              </p>
            </div>

            {/* CÓDIGO DEL PASE */}
            {invitado.codigo && (
              <div className="bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-center shrink-0">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-400">Código</p>
                <p className="font-mono text-xs font-bold text-stone-800">{invitado.codigo}</p>
              </div>
            )}
          </div>

          {/* CUPO / LÍMITE OFICIAL DE PASES ASIGNADOS */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                Tu invitación incluye:
              </p>
              <p className="text-xs text-stone-600 leading-relaxed max-w-sm">
                Cada pase concede el derecho de acceso a una persona al evento.
              </p>
            </div>
            <div className="text-center shrink-0 bg-white border border-amber-200/80 rounded-xl px-4 py-2 shadow-2xs">
              <span className="block text-2xl sm:text-3xl font-bold font-mono text-stone-900">
                {maxPases}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-800">
                {maxPases === 1 ? 'Pase Asignado' : 'Pases Asignados'}
              </span>
            </div>
          </div>

          {/* CÓDIGO QR Y PASE DIGITAL DE ACCESO */}
          {invitado.codigo && (
            <div className="bg-stone-50 border border-stone-200/90 rounded-2xl p-5 sm:p-6 text-center space-y-3.5 shadow-2xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800 bg-amber-100/70 px-3 py-1 rounded-full border border-amber-200/80 inline-block">
                  Pase Digital
                </span>
                <p className="text-xs text-stone-500 font-medium">Código de acceso</p>
                <div className="inline-block bg-white px-4 py-1.5 rounded-xl border border-stone-200 shadow-2xs font-mono text-sm font-bold text-stone-900 tracking-wider">
                  {invitado.codigo}
                </div>
              </div>

              {/* Contenedor del código QR */}
              <div className="inline-block bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(invitado.codigo)}&color=292524`}
                  alt={`Código QR de acceso para ${invitado.nombre}`}
                  width="160"
                  height="160"
                  className="w-36 h-36 sm:w-40 sm:h-40 mx-auto rounded-lg"
                  loading="lazy"
                />
              </div>

              <p className="text-[11px] text-stone-500 max-w-xs mx-auto leading-relaxed">
                Presenta este código QR o tu clave de acceso en la recepción del evento para registrar tu ingreso.
              </p>
            </div>
          )}

          {/* FEEDBACK: MENSAJE DE ÉXITO */}
          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0">✓</span>
              <p className="text-xs font-semibold">{successMessage}</p>
            </div>
          )}

          {/* FEEDBACK: MENSAJE DE ERROR */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs shrink-0">✕</span>
              <p className="text-xs font-semibold">{errorMessage}</p>
            </div>
          )}

          {/* ESTADO 1: CONFIRMADO (MODO CONSULTA) */}
          {confirmado === true && !isEditing && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-2xl mx-auto shadow-xs">
                ✓
              </div>
              <div className="space-y-1">
                <h4 className="text-lg sm:text-xl font-serif-luxury font-bold text-emerald-950">
                  ¡Asistencia confirmada!
                </h4>
                <p className="text-xs sm:text-sm text-emerald-800">
                  Te esperamos con gran emoción. Has confirmado la asistencia de:
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-sm border border-emerald-300">
                    <span>👥</span>
                    <span>{pasesConfirmados} {pasesConfirmados === 1 ? 'persona asistirá' : 'personas asistirán'}</span>
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700/80 pt-1">
                  ({pasesConfirmados} de {maxPases} pases disponibles confirmados)
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAttendance('yes');
                    setSelectedPases(pasesConfirmados);
                    setIsEditing(true);
                    setSuccessMessage(null);
                    setErrorMessage(null);
                  }}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline transition-colors cursor-pointer"
                >
                  ¿Necesitas modificar la cantidad o tu respuesta?
                </button>
              </div>
            </div>
          )}

          {/* ESTADO 2: NO ASISTIRÁ (MODO CONSULTA) */}
          {confirmado === false && !isEditing && (
            <div className="bg-stone-100/80 border border-stone-200 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-stone-300 text-stone-700 flex items-center justify-center text-xl mx-auto">
                ✕
              </div>
              <div className="space-y-1">
                <h4 className="text-lg sm:text-xl font-serif-luxury font-bold text-stone-900">
                  Gracias por avisarnos
                </h4>
                <p className="text-xs sm:text-sm text-stone-600 max-w-sm mx-auto">
                  Lamentamos que no puedas acompañarnos, pero agradecemos sinceramente que nos hayas informado.
                </p>
                <p className="text-[11px] text-stone-400 pt-1">
                  (0 pases confirmados de {maxPases} pases asignados)
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAttendance('yes');
                    setSelectedPases(maxPases);
                    setIsEditing(true);
                    setSuccessMessage(null);
                    setErrorMessage(null);
                  }}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline transition-colors cursor-pointer"
                >
                  ¿Cambiaste de planes? Confirmar asistencia
                </button>
              </div>
            </div>
          )}

          {/* ESTADO 3: FORMULARIO INTERACTIVO (PENDIENTE O EN EDICIÓN) */}
          {isEditing && (
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  ¿Nos acompañarás?
                </label>
                
                {/* BOTONES DE DECISIÓN: SÍ / NO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAttendance('yes')}
                    className={`py-3.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      selectedAttendance === 'yes'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-300'
                    }`}
                  >
                    <span>✓</span>
                    <span>Sí, asistiré</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAttendance('no')}
                    className={`py-3.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      selectedAttendance === 'no'
                        ? 'bg-stone-800 text-white border-stone-800 shadow-sm'
                        : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-300'
                    }`}
                  >
                    <span>✕</span>
                    <span>No podré asistir</span>
                  </button>
                </div>
              </div>

              {/* SELECCIÓN DE CANTIDAD DE PERSONAS (SOLO SI SELECCIONÓ SÍ) */}
              {selectedAttendance === 'yes' && (
                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label htmlFor="pases-select" className="block text-xs font-bold uppercase tracking-wider text-stone-800">
                        ¿Cuántas personas asistirán?
                      </label>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Tienes {maxPases} {maxPases === 1 ? 'pase disponible' : 'pases disponibles'}.
                      </p>
                    </div>
                  </div>

                  {/* SELECTOR DESPLEGABLE CON LÍMITE ESTRICTO DE 1 A NUMERO_PASES */}
                  <div className="relative">
                    <select
                      id="pases-select"
                      value={selectedPases}
                      onChange={(e) => setSelectedPases(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                    >
                      {pasesOptions.map((num) => (
                        <option key={num} value={num}>
                          {num} {num === 1 ? 'persona (1 pase)' : `personas (${num} pases)`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* MENSAJE DE CONDOLENCIA SI MARCA NO ASISTIR */}
              {selectedAttendance === 'no' && (
                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 text-stone-600 text-xs leading-relaxed">
                  Lamentamos mucho no poder contar contigo. Tu respuesta registrará 0 pases confirmados y permitirá una mejor organización del evento.
                </div>
              )}

              {/* BOTÓN DE ENVÍO */}
              <div className="flex items-center gap-3 pt-2">
                {confirmado !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setErrorMessage(null);
                    }}
                    className="w-1/3 py-3.5 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}

                <button
                  type="submit"
                  disabled={loading || selectedAttendance === null}
                  className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedAttendance === 'no'
                      ? 'bg-stone-800 hover:bg-stone-900 text-stone-100'
                      : 'bg-stone-900 hover:bg-stone-800 text-amber-200'
                  }`}
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-amber-200/30 border-t-amber-200 rounded-full animate-spin" />
                      <span>Guardando respuesta...</span>
                    </>
                  ) : (
                    <span>
                      {selectedAttendance === 'no'
                        ? 'Confirmar que no podré asistir'
                        : `Confirmar Asistencia (${selectedPases} ${selectedPases === 1 ? 'persona' : 'personas'})`}
                    </span>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>
      </div>
    </div>
  );
};
