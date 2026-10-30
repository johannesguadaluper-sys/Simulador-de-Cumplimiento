import React, { useState } from 'react';
import {
  DispersalBatch,
  DispersalItem,
  UserPersona,
  DictamenCumplimiento,
} from '../types/spei';
import {
  ejecutarScreeningPld,
  generarSha256,
  LISTAS_SINTETICAS_PLD,
} from '../utils/speiValidation';
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  UserCheck,
  Send,
  Eye,
  KeyRound,
  ArrowRight,
  Stamp,
  FileWarning,
} from 'lucide-react';

interface ComplianceViewProps {
  currentBatch: DispersalBatch;
  onUpdateBatch: (batch: DispersalBatch) => void;
  onAdvanceToAuditor: () => void;
  persona: UserPersona;
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  currentBatch,
  onUpdateBatch,
  onAdvanceToAuditor,
  persona,
}) => {
  const [selectedItem, setSelectedItem] = useState<DispersalItem | null>(
    currentBatch.items.length > 0 ? currentBatch.items[0] : null
  );
  const [dictamenResultado, setDictamenResultado] = useState<
    'APROBADO_CON_DOCUMENTACION' | 'RECHAZADO_CON_MOTIVO' | 'APROBADO_CONDICIONADO'
  >('APROBADO_CON_DOCUMENTACION');
  const [dictamenMotivo, setDictamenMotivo] = useState<string>(
    'Revisión PLD/FT completada. Expedientes KYC validados y cotejados contra listas restringidas sintéticas conforme a la Disposición de Carácter General CNBV Art. 115.'
  );
  const [reporteModalItem, setReporteModalItem] = useState<DispersalItem | null>(null);
  const [tipoReporteSiti, setTipoReporteSiti] = useState<'ROI_INUSUAL' | 'ROIP_INTERNA' | 'REPORTE_24H_BLOQUEO'>('ROI_INUSUAL');
  const [descReporteSiti, setDescReporteSiti] = useState<string>('');
  const [isSigning, setIsSigning] = useState<boolean>(false);

  // Segregación de funciones check
  const esMismoUsuario = currentBatch.createdBy.id === persona.id;

  // Ejecutar screening interactivo para actualizar un item
  const handleRunScreening = (item: DispersalItem) => {
    const screeningResult = ejecutarScreeningPld(item);
    const updatedItems = currentBatch.items.map((i) =>
      i.id === item.id ? { ...i, screeningPld: screeningResult } : i
    );
    const updatedBatch = { ...currentBatch, items: updatedItems };
    onUpdateBatch(updatedBatch);
    setSelectedItem({ ...item, screeningPld: screeningResult });
  };

  // Alternar documento de expediente KYC
  const handleToggleKycDoc = (
    itemId: string,
    docKey: keyof DispersalItem['screeningPld']['expedienteDoc']
  ) => {
    const updatedItems = currentBatch.items.map((i) => {
      if (i.id === itemId) {
        const newDocState = {
          ...i.screeningPld.expedienteDoc,
          [docKey]: !i.screeningPld.expedienteDoc[docKey],
        };
        const kycVigente = Object.values(newDocState).every(Boolean);
        return {
          ...i,
          screeningPld: {
            ...i.screeningPld,
            expedienteDoc: newDocState,
            kycVigente,
          },
        };
      }
      return i;
    });

    const updatedBatch = { ...currentBatch, items: updatedItems };
    onUpdateBatch(updatedBatch);
    if (selectedItem?.id === itemId) {
      const updatedSel = updatedItems.find((i) => i.id === itemId);
      if (updatedSel) setSelectedItem(updatedSel);
    }
  };

  // Emitir reporte regulatorio SITI PLD
  const handleEmitirReporteSiti = () => {
    if (!reporteModalItem) return;

    const folioReporte = `SITI-PLD-${tipoReporteSiti}-${new Date().getFullYear()}-${Math.floor(
      10000 + Math.random() * 90000
    )}`;

    const nuevoReporte = {
      tipo: tipoReporteSiti,
      folioSitiPld: folioReporte,
      descripcion:
        descReporteSiti ||
        `Alerta generada por coincidencia en ${reporteModalItem.screeningPld.listaCoincidencia || 'perfil inusual'} para ${reporteModalItem.beneficiario}.`,
      fechaGeneracion: new Date().toISOString(),
    };

    const reportesPrevios = currentBatch.dictamenCumplimiento?.reportesEmitidos || [];

    const dictamenPrevio = currentBatch.dictamenCumplimiento || {
      fechaHora: new Date().toISOString(),
      oficialId: persona.id,
      oficialNombre: persona.nombre,
      oficialCertificadoCnbv: persona.certificadoId,
      resultado: 'APROBADO_CONDICIONADO',
      motivoJustificacion: dictamenMotivo,
      reportesEmitidos: [],
      firmaElectronica: {
        numeroSerieCertificado: persona.certificadoId,
        cadenaOriginal: '',
        selloDigitalSha256: '',
        algoritmo: 'SHA-256withRSA',
        timestamp: new Date().toISOString(),
      },
    };

    onUpdateBatch({
      ...currentBatch,
      dictamenCumplimiento: {
        ...dictamenPrevio,
        reportesEmitidos: [...reportesPrevios, nuevoReporte],
      },
    });

    setReporteModalItem(null);
    setDescReporteSiti('');
  };

  // Firmar y Dictaminar Lote con e.firma simulada
  const handleFirmarDictamen = async () => {
    setIsSigning(true);

    const timestamp = new Date().toISOString();
    const cadenaOriginal = `||${currentBatch.folio}|${dictamenResultado}|${persona.id}|${persona.certificadoId}|${currentBatch.totalMonto}|${timestamp}||`;
    const selloDigital = await generarSha256(cadenaOriginal);

    const dictamen: DictamenCumplimiento = {
      fechaHora: timestamp,
      oficialId: persona.id,
      oficialNombre: persona.nombre,
      oficialCertificadoCnbv: persona.certificadoId,
      resultado: dictamenResultado,
      motivoJustificacion: dictamenMotivo,
      reportesEmitidos: currentBatch.dictamenCumplimiento?.reportesEmitidos || [],
      firmaElectronica: {
        numeroSerieCertificado: persona.certificadoId,
        cadenaOriginal,
        selloDigitalSha256: selloDigital,
        algoritmo: 'SHA-256withRSA',
        timestamp,
      },
    };

    const updatedBatch: DispersalBatch = {
      ...currentBatch,
      etapa: dictamenResultado === 'RECHAZADO_CON_MOTIVO' ? 'RECHAZADO' : 'DICTAMINADO',
      dictamenCumplimiento: dictamen,
    };

    onUpdateBatch(updatedBatch);
    setIsSigning(false);

    // Avanzar a rol de auditor
    onAdvanceToAuditor();
  };

  // Conteo de alertas
  const totalCoincidencias = currentBatch.items.filter(
    (i) => i.screeningPld.status === 'COINCIDENCIA'
  ).length;
  const totalInusuales = currentBatch.items.filter(
    (i) => i.screeningPld.perfilTransaccional === 'INUSUAL'
  ).length;
  const totalKycIncompleto = currentBatch.items.filter(
    (i) => !i.screeningPld.kycVigente
  ).length;

  return (
    <div className="space-y-6">
      {/* Title & Segregation Alert */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <span>ROL 2 · Segregación de Funciones</span>
            <span>·</span>
            <span>Prevención de Lavado de Dinero (PLD/FT)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Oficial de Cumplimiento Certificado CNBV
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Aplica el checklist de debida diligencia sobre el lote{' '}
            <strong className="font-mono text-slate-900 dark:text-white">{currentBatch.folio}</strong>: screening en
            listas restringidas (OFAC, SAT 69-B, UIF), coherencia transaccional, expedientes KYC y emisión de dictamen
            con e.firma.
          </p>
        </div>

        {/* Status of Lote */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-right">
            <div className="text-slate-500 text-[10px] uppercase font-semibold">Lote en Dictamen</div>
            <div className="font-mono font-bold text-slate-900 dark:text-white">{currentBatch.folio}</div>
          </div>
        </div>
      </div>

      {/* Segregation Violation Banner if applicable */}
      {esMismoUsuario && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <strong className="text-sm font-bold block mb-1">
              Violación Crítica de Segregación de Funciones (CNBV Art. 115)
            </strong>
            El usuario que originó el lote (<code>{currentBatch.createdBy.nombre}</code>) es idéntico al oficial firmante.
            La regulación financiera mexicana prohíbe que la misma persona capture y autorice/dictamine dispersiones de fondos.
            Para mantener el cumplimiento, asigne un usuario independiente.
          </div>
        </div>
      )}

      {/* Summary KPI Strip for Compliance Check */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Coincidencias en Listas Negras
          </div>
          <div className="text-lg font-mono font-bold mt-1 tabular-nums text-slate-900 dark:text-white">
            {totalCoincidencias > 0 ? (
              <span className="text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5" />
                <span>{totalCoincidencias} Alerta(s)</span>
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5" />
                <span>0 Coincidencias</span>
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">OFAC, SAT 69-B, Lista UIF</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Perfil Transaccional Inusual
          </div>
          <div className="text-lg font-mono font-bold mt-1 tabular-nums text-slate-900 dark:text-white">
            {totalInusuales > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">{totalInusuales} por encima de perfil</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">100% Coherente</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">Desviación del histórico cliente</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Expediente Digital KYC
          </div>
          <div className="text-lg font-mono font-bold mt-1 tabular-nums text-slate-900 dark:text-white">
            {totalKycIncompleto > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">{totalKycIncompleto} expediente(s) con faltantes</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">Expedientes Vigentes</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">INE, Comprobante, CIF, UBO</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Reportes SITI PLD Emitidos
          </div>
          <div className="text-lg font-mono font-bold mt-1 tabular-nums text-slate-900 dark:text-white">
            {(currentBatch.dictamenCumplimiento?.reportesEmitidos || []).length} Reporte(s)
          </div>
          <div className="text-xs text-slate-500 mt-1">ROI / ROIP / 24 Horas</div>
        </div>
      </div>

      {/* Main Screening Table & Drill-down Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Register List with screening status */}
        <div className="lg:col-span-7 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Checklist PLD/FT por Registro Transaccional
            </h3>
            <span className="text-xs text-slate-500">Haga clic en un registro para auditar</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Beneficiario / RFC</th>
                  <th className="py-2.5 px-3 text-right">Monto</th>
                  <th className="py-2.5 px-3">Screening Listas</th>
                  <th className="py-2.5 px-3">Perfil</th>
                  <th className="py-2.5 px-3">KYC</th>
                  <th className="py-2.5 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {currentBatch.items.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const isMatch = item.screeningPld.status === 'COINCIDENCIA';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[170px]">
                          {item.beneficiario}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">{item.rfcCurp}</div>
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap text-slate-900 dark:text-white">
                        ${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        {isMatch ? (
                          <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>COINCIDENCIA ({item.screeningPld.porcentajeHomonimia}%)</span>
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SIN COINCIDENCIA</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            item.screeningPld.perfilTransaccional === 'INUSUAL'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.screeningPld.perfilTransaccional}
                        </span>
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        {item.screeningPld.kycVigente ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Vigente</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 font-semibold">Incompleto</span>
                        )}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunScreening(item);
                          }}
                          className="px-2 py-1 text-[10px] bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-300"
                          title="Re-ejecutar screening"
                        >
                          Re-Screening
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quick Info Box */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-600 dark:text-slate-400">
            <strong>Bases de datos sintéticas simuladas en este Laboratorio:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
              <li>OFAC SDN (Specially Designated Nationals) - Departamento del Tesoro EUA</li>
              <li>SAT Art. 69-B CFF (Lista de Empresas que Facturan Operaciones Simuladas - EFOS)</li>
              <li>Lista de Personas Bloqueadas (LPB) - Unidad de Inteligencia Financiera (UIF)</li>
              <li>Personas Políticamente Expuestas (PEPs Nacionales e Internacionales)</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Detailed Screening Inspector for Selected Item */}
        <div className="lg:col-span-5 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-500" />
              <span>Inspección de Debida Diligencia</span>
            </h3>
            {selectedItem && (
              <span className="text-[11px] font-mono text-slate-500">{selectedItem.id}</span>
            )}
          </div>

          {selectedItem ? (
            <div className="space-y-4 text-xs">
              {/* Beneficiary Header Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500 uppercase font-semibold">Beneficiario Sujeto a Examen</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedItem.beneficiario}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  <span>RFC: {selectedItem.rfcCurp}</span>
                  <span>·</span>
                  <span>Monto: ${selectedItem.monto.toLocaleString('es-MX')} MXN</span>
                </div>
              </div>

              {/* A) Screening sintético */}
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>a) Screening Sintético en Listas:</span>
                  <span
                    className={
                      selectedItem.screeningPld.status === 'COINCIDENCIA'
                        ? 'text-red-600 font-bold'
                        : 'text-emerald-600 font-semibold'
                    }
                  >
                    {selectedItem.screeningPld.status === 'COINCIDENCIA'
                      ? `COINCIDENCIA (${selectedItem.screeningPld.porcentajeHomonimia}%)`
                      : 'SIN COINCIDENCIA'}
                  </span>
                </div>

                {selectedItem.screeningPld.status === 'COINCIDENCIA' ? (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded text-red-800 dark:text-red-300 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Alerta Regulatoria: {selectedItem.screeningPld.listaCoincidencia}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {selectedItem.screeningPld.detalleAlerta}
                    </p>
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setReporteModalItem(selectedItem);
                          setTipoReporteSiti(
                            selectedItem.screeningPld.listaCoincidencia === 'UIF_BLOQUEADAS'
                              ? 'REPORTE_24H_BLOQUEO'
                              : 'ROI_INUSUAL'
                          );
                        }}
                        className="px-2.5 py-1 text-[11px] bg-red-600 hover:bg-red-700 text-white rounded font-medium flex items-center gap-1 shadow-xs"
                      >
                        <FileWarning className="w-3 h-3" />
                        <span>Generar Reporte SITI PLD</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 rounded text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Sin coincidencias en OFAC SDN, SAT 69-B, Lista UIF ni PEPs.</span>
                  </div>
                )}
              </div>

              {/* B) Perfil Transaccional */}
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  b) Coherencia con Perfil Transaccional Declarado:
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monto Declarado en Registro:</span>
                    <span className="font-mono font-medium">
                      ${selectedItem.screeningPld.montoPerfilDeclarado.toLocaleString('es-MX')}.00 MXN
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monto a Dispersar en Lote:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ${selectedItem.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                    </span>
                  </div>
                  <div className="pt-1 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Dictamen de Coherencia:</span>
                    <span
                      className={`font-semibold ${
                        selectedItem.screeningPld.perfilTransaccional === 'INUSUAL'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {selectedItem.screeningPld.perfilTransaccional === 'INUSUAL'
                        ? 'OPERACIÓN INUSUAL (Desviación > 100%)'
                        : 'OPERACIÓN HABITUAL (Conforme)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* C) Validación KYC */}
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  c) Checklist de Expediente KYC (Art. 115 CNBV):
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedItem.screeningPld.expedienteDoc.ineVigente}
                      onChange={() => handleToggleKycDoc(selectedItem.id, 'ineVigente')}
                      className="rounded text-blue-600"
                    />
                    <span>Identificación Oficial Vigente (INE / Pasaporte)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedItem.screeningPld.expedienteDoc.comprobanteDomicilioMenor90d}
                      onChange={() =>
                        handleToggleKycDoc(selectedItem.id, 'comprobanteDomicilioMenor90d')
                      }
                      className="rounded text-blue-600"
                    />
                    <span>Comprobante de Domicilio no mayor a 90 días</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedItem.screeningPld.expedienteDoc.cifSat}
                      onChange={() => handleToggleKycDoc(selectedItem.id, 'cifSat')}
                      className="rounded text-blue-600"
                    />
                    <span>Cédula de Identificación Fiscal (CIF) SAT vigente</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedItem.screeningPld.expedienteDoc.beneficiarioFinalUbo}
                      onChange={() => handleToggleKycDoc(selectedItem.id, 'beneficiarioFinalUbo')}
                      className="rounded text-blue-600"
                    />
                    <span>Declaración de Beneficiario Final / UBO (Art. 21 Bis)</span>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              Seleccione un registro de la tabla para ver su desglose de debida diligencia.
            </div>
          )}
        </div>
      </div>

      {/* Dictamen Formal y Emisión de e.firma */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Stamp className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Emisión de Dictamen Formal y Sello Digital con e.firma
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Certificado Oficial: {persona.certificadoId}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Sentido del Dictamen de Cumplimiento
            </label>
            <select
              value={dictamenResultado}
              onChange={(e) =>
                setDictamenResultado(
                  e.target.value as 'APROBADO_CON_DOCUMENTACION' | 'RECHAZADO_CON_MOTIVO' | 'APROBADO_CONDICIONADO'
                )
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-semibold"
            >
              <option value="APROBADO_CON_DOCUMENTACION">APROBADO CON DOCUMENTACIÓN</option>
              <option value="APROBADO_CONDICIONADO">APROBADO CONDICIONADO (Con Reportes SITI)</option>
              <option value="RECHAZADO_CON_MOTIVO">RECHAZADO CON MOTIVO (Bloqueo)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Motivo y Justificación Técnica-Regulatoria
            </label>
            <input
              type="text"
              value={dictamenMotivo}
              onChange={(e) => setDictamenMotivo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              placeholder="Describa el sustento legal y de debida diligencia..."
            />
          </div>
        </div>

        {/* Existing SITI Reports Log if any */}
        {(currentBatch.dictamenCumplimiento?.reportesEmitidos || []).length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-700 text-xs">
            <div className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
              <FileWarning className="w-4 h-4 text-amber-500" />
              <span>Reportes SITI PLD emitidos para este Lote:</span>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              {currentBatch.dictamenCumplimiento?.reportesEmitidos.map((rep, idx) => (
                <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span className="text-red-500 font-bold">{rep.folioSitiPld}</span>
                  <span>{rep.tipo}</span>
                  <span className="truncate max-w-[300px]">{rep.descripcion}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button: Sign with PKI e.firma */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Oficial Firmante: <strong>{persona.nombre}</strong> ({persona.cargo})
            <div className="font-mono text-[11px]">IP Autorizada: {persona.ipSimulada}</div>
          </div>

          <button
            onClick={handleFirmarDictamen}
            disabled={isSigning}
            className={`px-5 py-2.5 text-xs font-bold text-white rounded-md transition-colors flex items-center gap-2 shadow-sm ${
              dictamenResultado === 'RECHAZADO_CON_MOTIVO'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>
              {isSigning
                ? 'Generando Sello Criptográfico SHA-256...'
                : `Firmar Dictamen (${dictamenResultado}) y Pasar a Rol 3: Auditor`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal: Reporte Regulatorio SITI PLD */}
      {reporteModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-red-500" />
                <span>Generar Reporte Regulatorio SITI PLD</span>
              </h3>
              <button
                onClick={() => setReporteModalItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                <div>Beneficiario: <strong>{reporteModalItem.beneficiario}</strong></div>
                <div>RFC: {reporteModalItem.rfcCurp}</div>
                <div>Monto Operación: ${reporteModalItem.monto.toLocaleString('es-MX')} MXN</div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Tipo de Reporte Regulatorio CNBV
                </label>
                <select
                  value={tipoReporteSiti}
                  onChange={(e) =>
                    setTipoReporteSiti(
                      e.target.value as 'ROI_INUSUAL' | 'ROIP_INTERNA' | 'REPORTE_24H_BLOQUEO'
                    )
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-medium"
                >
                  <option value="ROI_INUSUAL">Reporte de Operación Inusual (ROI - Plazo 60 días naturales)</option>
                  <option value="ROIP_INTERNA">Reporte de Operación Interna Preocupante (ROIP)</option>
                  <option value="REPORTE_24H_BLOQUEO">Reporte de 24 Horas (Lista de Personas Bloqueadas UIF)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Descripción y Razones de la Alerta
                </label>
                <textarea
                  rows={3}
                  value={descReporteSiti}
                  onChange={(e) => setDescReporteSiti(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-sans text-xs"
                  placeholder={`Describa el motivo de la alerta y la designación identificada...`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setReporteModalItem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleEmitirReporteSiti}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded"
              >
                Emitir Folio SITI PLD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
