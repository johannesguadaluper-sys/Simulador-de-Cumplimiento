import React from 'react';
import { AppRole, UserPersona, EnvironmentMode } from '../types/spei';
import { ArrowRight, UserCheck, ShieldAlert, Award, AlertTriangle, KeyRound } from 'lucide-react';

interface RoleBannerProps {
  currentRole: AppRole;
  persona: UserPersona;
  onNextRole: () => void;
  environmentMode: EnvironmentMode;
  onSelectRole: (role: AppRole) => void;
}

export const RoleBanner: React.FC<RoleBannerProps> = ({
  currentRole,
  persona,
  onNextRole,
  environmentMode,
  onSelectRole,
}) => {
  const getNextRoleName = (role: AppRole): { name: string; target: AppRole } => {
    switch (role) {
      case 'ORIGINADOR':
        return { name: 'Rol 2: Oficial de Cumplimiento', target: 'CUMPLIMIENTO' };
      case 'CUMPLIMIENTO':
        return { name: 'Rol 3: Auditor CNBV', target: 'AUDITOR' };
      case 'AUDITOR':
        return { name: 'Rol 1: Administrador Originador', target: 'ORIGINADOR' };
    }
  };

  const next = getNextRoleName(currentRole);

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-200">
      {/* Top Notice: Inviolable Rule #1 & #2 */}
      <div className="px-6 py-2 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-emerald-400 uppercase tracking-wider">
            {environmentMode === 'SANDBOX_SYNTHETIC'
              ? '● MODO PRODUCCIÓN — DATOS SINTÉTICOS'
              : '▲ MODO MAINNET STP BANXICO (TRANSFERENCIA REAL)'}
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="hidden md:inline">
            Regla Inviolable: Todo CURP, CLABE, nombre y monto son ficticios con prefijo TEST_001.
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span>Certificación CNBV Art. 115</span>
          <span>·</span>
          <span>STP Banxico SPEI/DIMO</span>
        </div>
      </div>

      {/* Role Segregation Header Bar */}
      <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Active Role Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onSelectRole('ORIGINADOR')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
              currentRole === 'ORIGINADOR'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Rol 1: Administrador Originador</span>
          </button>

          <button
            onClick={() => onSelectRole('CUMPLIMIENTO')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
              currentRole === 'CUMPLIMIENTO'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Rol 2: Oficial de Cumplimiento</span>
          </button>

          <button
            onClick={() => onSelectRole('AUDITOR')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
              currentRole === 'AUDITOR'
                ? 'bg-purple-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Rol 3: Auditor CNBV Certificado</span>
          </button>
        </div>

        {/* Next Role Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onNextRole}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-md transition-colors flex items-center gap-2 group shadow-sm"
          >
            <span>Siguiente rol: <strong className="text-emerald-300 font-medium">{next.name}</strong></span>
            <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Active Persona Details Strip */}
      <div className="px-6 py-2.5 bg-slate-950/40 border-t border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-300 font-medium">Operador activo:</span>
          <span className="text-white font-semibold">{persona.nombre}</span>
          <span className="text-slate-600">·</span>
          <span>{persona.cargo}</span>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-slate-400">{persona.id}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <KeyRound className="w-3 h-3" />
            <span>{persona.certificadoId}</span>
          </span>
          <span className="text-slate-600">·</span>
          <span>IP: {persona.ipSimulada}</span>
          <span className="text-slate-600">·</span>
          <span className="text-amber-400/90 font-sans font-medium">Segregación de funciones estricta</span>
        </div>
      </div>
    </div>
  );
};
