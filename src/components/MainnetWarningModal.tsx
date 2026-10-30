import React from 'react';
import { ShieldAlert, AlertTriangle, KeyRound, Server, ExternalLink, Lock } from 'lucide-react';

interface MainnetWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchMode: (mode: 'SANDBOX_SYNTHETIC' | 'MAINNET_REAL') => void;
  currentMode: 'SANDBOX_SYNTHETIC' | 'MAINNET_REAL';
}

export const MainnetWarningModal: React.FC<MainnetWarningModalProps> = ({
  isOpen,
  onClose,
  onSwitchMode,
  currentMode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-xl w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Entorno de Producción Mainnet STP Banxico vs Sandbox Sintético
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md text-amber-900 dark:text-amber-200">
            <strong>Reglas Inquebrantables de Cumplimiento:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1 text-[11px]">
              <li>
                <strong>Modo Sandbox (Actual):</strong> Requiere estrictamente datos sintéticos con identificador{' '}
                <code>TEST_001</code>. Queda prohibido ingresar CURP, RFC o cuentas CLABE reales para evitar incidentes
                de confidencialidad bajo Art. 115 CNBV.
              </li>
              <li>
                <strong>Modo Mainnet STP Banxico:</strong> Las transferencias reales con fondos de curso legal (MXN)
                únicamente pueden ejecutarse en Mainnet previa conexión criptográfica certificada.
              </li>
            </ul>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-blue-500" />
              <span>Requisitos Técnicos Obligatorios para Dispersión Real STP Mainnet:</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] font-mono text-slate-700 dark:text-slate-300">
              <li>Módulo de Seguridad Hardware (HSM FIPS 140-2 Nivel 3) para custodia de llaves privadas.</li>
              <li>Certificado Digital X.509 vigente emitido por Banco de México / SAT para firma de tramas SPEI.</li>
              <li>Túnel VPN dedicado con direccionamiento IP fijo autorizado en la infraestructura de STP Banxico.</li>
              <li>Saldo real acreditado en la cuenta de concentración financiera (Clave SPEI 646).</li>
              <li>Webhook transaccional para recepción y validación de CEP (Comprobante Electrónico de Pago).</li>
            </ol>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">
            Estado actual: <strong>{currentMode === 'SANDBOX_SYNTHETIC' ? 'Sandbox de Pruebas' : 'Mainnet'}</strong>
          </div>

          <div className="flex items-center gap-2">
            {currentMode === 'SANDBOX_SYNTHETIC' ? (
              <button
                onClick={() => {
                  onSwitchMode('MAINNET_REAL');
                  onClose();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 rounded border border-amber-300 dark:border-amber-700"
              >
                Simular Pasarela Mainnet Real
              </button>
            ) : (
              <button
                onClick={() => {
                  onSwitchMode('SANDBOX_SYNTHETIC');
                  onClose();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 rounded border border-emerald-300 dark:border-emerald-700"
              >
                Volver a Sandbox Sintético
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
