import React, { useState } from 'react';
import {
  validarClabeInterbancaria,
  calcularDigitoVerificadorClabe,
  TOPE_DIMO_UDIS,
  VALOR_UDI_DEFAULT,
} from '../utils/speiValidation';
import { Calculator, CheckCircle2, XCircle, ArrowRight, BookOpen } from 'lucide-react';

interface ClabeUdiCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyUdiValor?: (valor: number) => void;
}

export const ClabeUdiCalculatorModal: React.FC<ClabeUdiCalculatorModalProps> = ({
  isOpen,
  onClose,
  onApplyUdiValor,
}) => {
  const [testClabe, setTestClabe] = useState<string>('012180001234567897');
  const [udiPrice, setUdiPrice] = useState<number>(VALOR_UDI_DEFAULT);
  const [customUdis, setCustomUdis] = useState<number>(TOPE_DIMO_UDIS);

  if (!isOpen) return null;

  const clabeRes = validarClabeInterbancaria(testClabe);
  const clabeClean = testClabe.replace(/\D/g, '');
  const clabe17 = clabeClean.slice(0, 17);
  const calculatedDigit = calcularDigitoVerificadorClabe(clabe17);

  const totalMxnDimoLimit = customUdis * udiPrice;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Herramienta de Control: Validador Algorítmico CLABE & Calculadora UDI DIMO
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        {/* Section 1: Algoritmo CLABE Banxico */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span>1. Desglose y Verificación de CLABE Interbancaria (18 Dígitos)</span>
          </h4>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 font-medium mb-1">
              Ingrese CLABE de 18 dígitos para probar el algoritmo módulo 10:
            </label>
            <input
              type="text"
              value={testClabe}
              onChange={(e) => setTestClabe(e.target.value)}
              className="w-full px-3 py-2 font-mono text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="012180001234567897"
            />
          </div>

          {/* Breakdown Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-mono space-y-2">
            <div className="grid grid-cols-4 gap-2 text-center border-b border-slate-200 dark:border-slate-700 pb-2">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-sans">Banco (3d)</div>
                <div className="font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {clabeClean.slice(0, 3) || '---'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-sans">Plaza (3d)</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {clabeClean.slice(3, 6) || '---'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-sans">Cuenta (11d)</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                  {clabeClean.slice(6, 17) || '---'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-sans">Dígito Verif. (1d)</div>
                <div className="font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                  {clabeClean.slice(17, 18) || '-'}
                </div>
              </div>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
              <div>
                Institución: <strong>{clabeRes.bancoNombre}</strong>
              </div>
              <div>
                {clabeRes.valida ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Algoritmo Banxico Conforme (DV = {calculatedDigit})</span>
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{clabeRes.motivo}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700 font-sans">
              <strong>Fórmula Banco de México:</strong> Pesos ponderados [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7].
              Suma mod 10 resta de 10 mod 10.
            </div>
          </div>
        </div>

        {/* Section 2: Calculadora UDI DIMO */}
        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-purple-500" />
            <span>2. Conversor UDI (Unidades de Inversión) & Tope DIMO Banxico</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Valor Oficial UDI Banxico (MXN)
              </label>
              <input
                type="number"
                step="0.0001"
                value={udiPrice}
                onChange={(e) => setUdiPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Límite DIMO (Unidades de Inversión)
              </label>
              <input
                type="number"
                value={customUdis}
                onChange={(e) => setCustomUdis(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-md flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
            <div>
              <div className="font-semibold">Tope Máximo Legal por Operación DIMO:</div>
              <div className="font-mono text-base font-bold mt-0.5">
                ${totalMxnDimoLimit.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
              </div>
            </div>

            {onApplyUdiValor && (
              <button
                onClick={() => {
                  onApplyUdiValor(udiPrice);
                  onClose();
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs"
              >
                Aplicar al Simulador
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
