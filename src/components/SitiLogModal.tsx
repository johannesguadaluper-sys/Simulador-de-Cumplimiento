import React from 'react';
import { DispersalBatch } from '../types/spei';
import { FileWarning, CheckCircle2, ShieldCheck, Download, Clock } from 'lucide-react';

interface SitiLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: DispersalBatch;
}

export const SitiLogModal: React.FC<SitiLogModalProps> = ({ isOpen, onClose, batch }) => {
  if (!isOpen) return null;

  const reportes = batch.dictamenCumplimiento?.reportesEmitidos || [];

  const handleDownloadLog = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(batch, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `BITACORA_SITI_PLD_${batch.folio}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-purple-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Bitácora Regulatoria SITI PLD — CNBV Art. 115
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-400">
          Registro inalterable de comunicaciones regulatorias emitidas al Sistema Interinstitucional de Transferencia de
          Información (SITI PLD) de la Comisión Nacional Bancaria y de Valores.
        </div>

        {/* Lote Summary Box */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Folio de Lote SPEI:</span>
            <span className="font-bold text-slate-900 dark:text-white">{batch.folio}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Huella Digital SHA-256:</span>
            <span className="truncate max-w-[280px]">{batch.hashSha256Lote}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Origen Documentado:</span>
            <span>{batch.origenRecursos.fuente}</span>
          </div>
        </div>

        {/* Reports List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Reportes Transaccionales Registrados ({reportes.length})
          </h4>

          {reportes.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded border border-dashed border-slate-200 dark:border-slate-800">
              No se han emitido reportes de operaciones inusuales (ROI) o de 24 horas para este lote.
              Si detecta coincidencias en el Rol 2, emita el reporte regulatorio correspondiente.
            </div>
          ) : (
            <div className="space-y-2">
              {reportes.map((rep, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      {rep.folioSitiPld}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                      {rep.tipo}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{rep.descripcion}</p>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Emitido: {rep.fechaGeneracion}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleDownloadLog}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Bitácora SITI JSON</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
