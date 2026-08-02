import React, { useState } from 'react';

interface CopyBankDetailsProps {
  bankName: string;
  accountHolder: string;
  clabeNumber: string;
}

export const CopyBankDetails: React.FC<CopyBankDetailsProps> = ({
  bankName,
  accountHolder,
  clabeNumber,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(clabeNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-stone-50 border border-stone-200/80 p-6 rounded-2xl space-y-3 relative text-left">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
          Transferencia Bancaria
        </span>
        <span className="text-xs font-serif italic text-stone-500">{bankName}</span>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-stone-500 font-medium">Titular:</p>
        <p className="text-sm font-semibold text-stone-800">{accountHolder}</p>
      </div>

      <div className="space-y-1 pt-2 border-t border-stone-200/60">
        <p className="text-xs text-stone-500 font-medium">CLABE Interbancaria:</p>
        <div className="flex items-center justify-between gap-2">
          <code className="text-xs sm:text-sm font-mono font-bold text-stone-900 bg-stone-100 px-3 py-1.5 rounded-lg">
            {clabeNumber}
          </code>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white transition-all duration-300 shrink-0"
          >
            {copied ? '¡Copiado! ✓' : 'Copiar CLABE'}
          </button>
        </div>
      </div>
    </div>
  );
};
