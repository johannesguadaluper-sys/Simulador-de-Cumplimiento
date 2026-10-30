import React from 'react';
import { AppRole, EnvironmentMode } from '../types/spei';
import { ShieldCheck, ArrowRight, RefreshCw, FileSpreadsheet, Lock } from 'lucide-react';

interface NavbarProps {
  currentRole: AppRole;
  onSelectRole: (role: AppRole) => void;
  environmentMode: EnvironmentMode;
  onToggleEnvironment: () => void;
  onOpenCalculator: () => void;
  onOpenAuditLog: () => void;
  onNewBatchModal: () => void;
  onOpenStpConsole?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onSelectRole,
  environmentMode,
  onToggleEnvironment,
  onOpenCalculator,
  onOpenAuditLog,
  onNewBatchModal,
  onOpenStpConsole,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 bg-slate-900 border-b border-slate-800 text-slate-100">
      {/* Zone 1: Single text element wordmark */}
      <a href="/" className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-slate-200 transition-colors">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <span>SPEI Compliance Lab</span>
      </a>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
        <button
          onClick={() => onSelectRole('ORIGINADOR')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            currentRole === 'ORIGINADOR' ? 'text-white font-semibold underline underline-offset-8 decoration-emerald-400' : ''
          }`}
        >
          1. Originador
        </button>
        <button
          onClick={() => onSelectRole('CUMPLIMIENTO')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            currentRole === 'CUMPLIMIENTO' ? 'text-white font-semibold underline underline-offset-8 decoration-emerald-400' : ''
          }`}
        >
          2. Cumplimiento
        </button>
        <button
          onClick={() => onSelectRole('AUDITOR')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            currentRole === 'AUDITOR' ? 'text-white font-semibold underline underline-offset-8 decoration-emerald-400' : ''
          }`}
        >
          3. Auditor CNBV
        </button>
        {onOpenStpConsole && (
          <button
            onClick={onOpenStpConsole}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 text-slate-400"
          >
            Consola STP
          </button>
        )}
        <button
          onClick={onOpenCalculator}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 text-slate-400"
        >
          Validador CLABE/UDI
        </button>
        <button
          onClick={onOpenAuditLog}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 text-slate-400"
        >
          Bitácora SITI
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleEnvironment}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            environmentMode === 'MAINNET_REAL'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80 shadow-xs'
              : 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60'
          }`}
          title="Alternar entre Producción Mainnet Real y Sandbox de Entrenamiento"
        >
          <span className={`w-2 h-2 rounded-full ${environmentMode === 'MAINNET_REAL' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          <span>{environmentMode === 'MAINNET_REAL' ? 'Producción Mainnet' : 'Sandbox Aspirantes'}</span>
        </button>

        <button
          onClick={onNewBatchModal}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-emerald-400 rounded-md hover:bg-emerald-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>{environmentMode === 'MAINNET_REAL' ? 'Nuevo Lote Real' : 'Nuevo Lote TEST'}</span>
        </button>
      </div>
    </header>
  );
};
