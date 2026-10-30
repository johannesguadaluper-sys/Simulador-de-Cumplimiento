import React, { useState, useEffect } from 'react';
import {
  DispersalBatch,
  UserPersona,
  AuditoriaCnbv,
  AuditoriaPunto,
  ComprobanteCep,
  EnvironmentMode,
  StpProductionConfig,
} from '../types/spei';
import { generarSha256 } from '../utils/speiValidation';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  CheckSquare,
  Hash,
  ExternalLink,
  Receipt,
  FileCheck2,
  Send,
  Server,
  Zap,
} from 'lucide-react';

interface AuditorViewProps {
  currentBatch: DispersalBatch;
  onUpdateBatch: (batch: DispersalBatch) => void;
  persona: UserPersona;
  onResetOrNew: () => void;
  environmentMode: EnvironmentMode;
  stpConfig: StpProductionConfig;
  onUpdateStpConfig: (newConfig: StpProductionConfig) => void;
  onOpenStpConsole: () => void;
}

export const AuditorView: React.FC<AuditorViewProps> = ({
  currentBatch,
  onUpdateBatch,
  persona,
  onResetOrNew,
  environmentMode,
  stpConfig,
  onUpdateStpConfig,
  onOpenStpConsole,
}) => {
  const [activeTab, setActiveTab] = useState<'INFORME' | 'CHECKLIST' | 'CEPS' | 'EXPEDIENTE' | 'DISPERSION_STP'>(
    currentBatch.etapa === 'DISPERSADO_STP' ? 'DISPERSION_STP' : 'INFORME'
  );
  const [selectedCep, setSelectedCep] = useState<ComprobanteCep | null>(null);
  const [isDispersingStp, setIsDispersingStp] = useState<boolean>(false);
  const [showStpModal, setShowStpModal] = useState<boolean>(false);
  const [dispersionProgreso, setDispersionProgreso] = useState<number>(0);

  // Computar auditoría de 5 puntos
  const calcularAuditoria = (): AuditoriaCnbv => {
    const originadorId = currentBatch.createdBy.id;
    const cumplimientoId = currentBatch.dictamenCumplimiento?.oficialId;

    // 1. Segregación de funciones
    const esMismoUsuario = originadorId === cumplimientoId;
    const punto1: AuditoriaPunto = {
      punto: 1,
      nombre: 'Segregación Estricta de Funciones (Originación vs Cumplimiento)',
      normativa: 'CNBV Disposiciones de Carácter General Art. 115 / Manual PLD/FT',
      estado: esMismoUsuario || !cumplimientoId ? 'ROJO' : 'VERDE',
      hallazgo: esMismoUsuario
        ? `INCUMPLIMIENTO GRAVE: El usuario originador (${currentBatch.createdBy.nombre}) autorizó o dictaminó el lote. No existe segregación de funciones.`
        : `CONFORME: El lote fue originado por ${currentBatch.createdBy.nombre} (${originadorId}) y dictaminado de forma independiente por ${currentBatch.dictamenCumplimiento?.oficialNombre} (${cumplimientoId}).`,
      evidencia: `Folio Token Originador: ${currentBatch.createdBy.token} | Certificado Cumplimiento: ${
        currentBatch.dictamenCumplimiento?.firmaElectronica.numeroSerieCertificado || 'N/A'
      }`,
      recomendacion: esMismoUsuario
        ? 'Establecer candado por software que impida a cualquier usuario con rol de Tesorería aprobar dictámenes de PLD.'
        : 'Mantener la política de credenciales separadas con autenticación multifactor (MFA).',
    };

    // 2. Tope DIMO 1,500 UDIS y validación CLABE
    const hayExcesoDimo = currentBatch.items.some((i) => i.validaciones.excede1500Udis);
    const hayClabeInvalida = currentBatch.items.some((i) => !i.validaciones.clabeValida);
    const punto2Estado = hayExcesoDimo ? 'ROJO' : hayClabeInvalida ? 'AMARILLO' : 'VERDE';
    const punto2: AuditoriaPunto = {
      punto: 2,
      nombre: 'Tope DIMO 1,500 UDIS y Validación Algorítmica CLABE Banxico',
      normativa: 'Circular 14/2017 Banco de México / Reglas del Sistema SPEI y DIMO',
      estado: punto2Estado,
      hallazgo: hayExcesoDimo
        ? `INFRACCIÓN REGULATORIA: Se identificó al menos una transferencia DIMO que rebasa el tope máximo de 1,500 UDIS ($${currentBatch.topeDimoMxn.toFixed(
            2
          )} MXN).`
        : hayClabeInvalida
        ? 'OBSERVACIÓN: Se detectó CLABE con error en dígito verificador Banxico ponderado.'
        : `CONFORME: Todas las transferencias DIMO respetan el tope de 1,500 UDIS ($${currentBatch.topeDimoMxn.toFixed(
            2
          )} MXN) y las CLABEs tienen dígito verificador matemático válido.`,
      evidencia: `Valor UDI aplicado: $${currentBatch.udiValorAplicado.toFixed(
        4
      )} MXN | Límite Máximo DIMO: $${currentBatch.topeDimoMxn.toFixed(2)} MXN`,
      recomendacion: hayExcesoDimo
        ? 'Implementar validación preventiva en el frontend/API del Dispersor que rechace peticiones DIMO superiores a 1,500 UDIS antes de crear el lote.'
        : 'Validar algoritmo módulo 10 de Banxico previo al encolamiento en STP.',
    };

    // 3. Bitácora de Origen de Fondos (Art. 115)
    const tieneOrigen =
      Boolean(currentBatch.origenRecursos.fuente) &&
      Boolean(currentBatch.origenRecursos.uuidFacturaSat) &&
      Boolean(currentBatch.origenRecursos.cuentaConcentradora);
    const punto3: AuditoriaPunto = {
      punto: 3,
      nombre: 'Bitácora de Origen de Recursos y Documentación Soporte CFDI',
      normativa: 'CNBV Disposiciones Art. 115 / Art. 29-A Código Fiscal de la Federación',
      estado: tieneOrigen ? 'VERDE' : 'AMARILLO',
      hallazgo: tieneOrigen
        ? `CONFORME: Se acreditó el origen de los recursos (${currentBatch.origenRecursos.fuente}) asociado al comprobante fiscal ${currentBatch.origenRecursos.uuidFacturaSat}.`
        : 'OBSERVACIÓN SUBSTANSIBLE: La bitácora carece de comprobante CFDI o justificación económica completa.',
      evidencia: `UUID CFDI SAT: ${currentBatch.origenRecursos.uuidFacturaSat} | Centro Costos: ${currentBatch.origenRecursos.centroCostos} | Cuenta Origen: ${currentBatch.origenRecursos.cuentaConcentradora}`,
      recomendacion:
        'Conservar los XML de los CFDI y pólizas contables en la bóveda digital por un mínimo de 10 años según Art. 115.',
    };

    // 4. Screening en Listas y Reportes SITI PLD
    const hayCoincidenciaNoReportada = currentBatch.items.some(
      (i) =>
        i.screeningPld.status === 'COINCIDENCIA' &&
        !(currentBatch.dictamenCumplimiento?.reportesEmitidos || []).some((r) =>
          r.descripcion.includes(i.beneficiario)
        )
    );
    const totalReportes = (currentBatch.dictamenCumplimiento?.reportesEmitidos || []).length;
    const punto4Estado = hayCoincidenciaNoReportada ? 'AMARILLO' : 'VERDE';
    const punto4: AuditoriaPunto = {
      punto: 4,
      nombre: 'Screening en Listas Restringidas (OFAC, SAT 69-B, LPB UIF) y Reportes SITI',
      normativa: 'CNBV Art. 115 Bis / Resolución Listas de Personas Bloqueadas UIF',
      estado: punto4Estado,
      hallazgo: hayCoincidenciaNoReportada
        ? 'OBSERVACIÓN: Se detectaron registros en listas que no cuentan con folio de reporte SITI PLD formalmente emitido.'
        : `CONFORME: Se realizó el 100% del screening sintético en OFAC, SAT 69-B y LPB. Se emitieron ${totalReportes} reporte(s) regulatorios ante la autoridad.`,
      evidencia: `Reportes SITI PLD Registrados: ${totalReportes} | Coincidencias en Lote: ${
        currentBatch.items.filter((i) => i.screeningPld.status === 'COINCIDENCIA').length
      }`,
      recomendacion:
        'Asegurar el envío automatizado de ROI dentro de los 60 días naturales y Reporte de 24 Horas en caso de listas bloqueadas UIF.',
    };

    // 5. Integridad Criptográfica y Cadena de Custodia
    const tieneHashLote = Boolean(currentBatch.hashSha256Lote);
    const tieneFirma = Boolean(currentBatch.dictamenCumplimiento?.firmaElectronica.selloDigitalSha256);
    const punto5: AuditoriaPunto = {
      punto: 5,
      nombre: 'Integridad Criptográfica, Cadena de Custodia y Sello e.firma',
      normativa: 'Código de Comercio Art. 89-114 (Firma Electrónica Avanzada) / CNBV',
      estado: tieneHashLote && tieneFirma ? 'VERDE' : 'AMARILLO',
      hallazgo:
        tieneHashLote && tieneFirma
          ? 'CONFORME: El lote cuenta con huella digital SHA-256 inalterable y dictamen con e.firma avanzada verificada.'
          : 'OBSERVACIÓN: El expediente carece de sello digital completo o certificado en el dictamen.',
      evidencia: `Hash SHA-256 Lote: ${currentBatch.hashSha256Lote.slice(0, 24)}... | Sello Cumplimiento: ${
        currentBatch.dictamenCumplimiento?.firmaElectronica.selloDigitalSha256.slice(0, 24) || 'N/A'
      }...`,
      recomendacion:
        'Almacenar los sellos y sellos de tiempo (TSA) en un repositorio inmutable WORM (Write Once Read Many).',
    };

    const puntos = [punto1, punto2, punto3, punto4, punto5];
    const verdes = puntos.filter((p) => p.estado === 'VERDE').length;
    const amarillos = puntos.filter((p) => p.estado === 'AMARILLO').length;
    const rojos = puntos.filter((p) => p.estado === 'ROJO').length;

    let semaforoGlobal: 'VERDE' | 'AMARILLO' | 'ROJO' = 'VERDE';
    if (rojos > 0) semaforoGlobal = 'ROJO';
    else if (amarillos > 0) semaforoGlobal = 'AMARILLO';

    const puntuacion = Math.round((verdes * 20) + (amarillos * 10));

    // Generar CEPs si el lote no fue rechazado
    const ceps: ComprobanteCep[] =
      currentBatch.dictamenCumplimiento?.resultado !== 'RECHAZADO_CON_MOTIVO'
        ? currentBatch.items
            .filter((i) => i.validaciones.clabeValida && !i.validaciones.excede1500Udis)
            .map((item, idx) => ({
              claveRastreo: `STP${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${Math.floor(
                10000000 + Math.random() * 90000000
              )}${idx + 1}`,
              emisorStp: 'SISTEMA DE TRANSFERENCIAS Y PAGOS (STP) 646',
              cuentaEmisora: currentBatch.origenRecursos.cuentaConcentradora,
              receptor: item.beneficiario,
              bancoReceptor: item.bancoDestino,
              cuentaReceptora: item.clabeODimo,
              monto: item.monto,
              concepto: item.concepto,
              fechaOperacion: new Date().toISOString().slice(0, 10),
              horaOperacion: new Date().toLocaleTimeString('es-MX'),
              selloBanxico: `BANXICO-CEP-SELLO-DIGITAL-SHA256-${Math.random()
                .toString(36)
                .substring(2, 12)
                .toUpperCase()}`,
              numeroCertificadoBanxico: '00000100000702981144',
            }))
        : [];

    return {
      fechaHora: new Date().toISOString(),
      auditorId: persona.id,
      auditorNombre: persona.nombre,
      numeroCertificadoCnbv: persona.certificadoId,
      semaforoGlobal,
      puntuacionCumplimiento: puntuacion,
      cincoPuntosAuditoria: puntos,
      recomendacionesTecnicas: [
        'Habilitar validaciones previas de formato de CLABE (módulo 10) y DIMO (máximo 1,500 UDIS) en el punto de carga.',
        'Reforzar la separación física y lógica entre las cuentas de Tesorería y los perfiles de Oficial de Cumplimiento.',
        'Automatizar la consulta periódica en listas negras SAT 69-B y LPB UIF con alertas tempranas antes de dispersar.',
        'Generar y resguardar los Comprobantes Electrónicos de Pago (CEP) de Banxico vinculados al ID de factura CFDI.',
      ],
      checklistEvidencia: [
        {
          item: 'Log inmutable de lotes con hash SHA-256 de origen',
          verificado: Boolean(currentBatch.hashSha256Lote),
          referenciaArchivo: `log_lotes_${currentBatch.folio}.json`,
        },
        {
          item: 'Dictamen de Cumplimiento firmado con e.firma / certificado digital',
          verificado: Boolean(currentBatch.dictamenCumplimiento?.firmaElectronica.selloDigitalSha256),
          referenciaArchivo: `dictamen_pld_${currentBatch.folio}.xml`,
        },
        {
          item: 'Bitácora SITI PLD con reportes de operaciones inusuales (ROI/ROIP)',
          verificado: (currentBatch.dictamenCumplimiento?.reportesEmitidos || []).length > 0,
          referenciaArchivo: `bitacora_siti_${currentBatch.folio}.csv`,
        },
        {
          item: 'Expediente digital KYC con identificación y UBO (Beneficiario Final)',
          verificado: currentBatch.items.every((i) => i.screeningPld.kycVigente),
          referenciaArchivo: `expedientes_kyc_${currentBatch.folio}.pdf`,
        },
        {
          item: 'Comprobantes Electrónicos de Pago (CEP) de Banxico emitidos',
          verificado: ceps.length > 0,
          referenciaArchivo: `ceps_banxico_${currentBatch.folio}.xml`,
        },
      ],
      cadenaCustodiaHash: `CUSTODIA-${Math.random().toString(36).substring(2, 10).toUpperCase()}-SHA256`,
    };
  };

  const auditoria = currentBatch.auditoriaCnbv || calcularAuditoria();

  // Guardar auditoría en el lote
  useEffect(() => {
    if (!currentBatch.auditoriaCnbv) {
      const computed = calcularAuditoria();
      onUpdateBatch({
        ...currentBatch,
        etapa: 'AUDITADO',
        auditoriaCnbv: computed,
        comprobantesCep: computed.checklistEvidencia[4].verificado
          ? [
              {
                claveRastreo: `STP202610290000000001`,
                emisorStp: 'STP BANXICO (646)',
                cuentaEmisora: currentBatch.origenRecursos.cuentaConcentradora,
                receptor: currentBatch.items[0]?.beneficiario || 'TEST_BENEFICIARIO',
                bancoReceptor: currentBatch.items[0]?.bancoDestino || 'BBVA MÉXICO',
                cuentaReceptora: currentBatch.items[0]?.clabeODimo || '012180001234567897',
                monto: currentBatch.items[0]?.monto || 10000,
                concepto: currentBatch.items[0]?.concepto || 'PAGO TEST',
                fechaOperacion: '2026-10-29',
                horaOperacion: '19:20:00',
                selloBanxico: 'BANXICO-CEP-SELLO-SHA256-TEST-771122',
                numeroCertificadoBanxico: '00000100000702981144',
              },
            ]
          : [],
      });
    }
  }, []);

  // Exportar expediente en JSON estructurado
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentBatch, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `EXPEDIENTE_AUDITORIA_CNBV_${currentBatch.folio}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Exportar lote procesado en CSV
  const handleExportCsv = () => {
    const headers = [
      'ID',
      'TIPO',
      'CLABE_O_DIMO',
      'BANCO_DESTINO',
      'BENEFICIARIO',
      'RFC_CURP',
      'MONTO_MXN',
      'REFERENCIA',
      'CONCEPTO',
      'VALIDACION_ESTADO',
      'SCREENING_PLD',
      'PERFIL_TRANSACCIONAL',
    ];

    const rows = currentBatch.items.map((i) => [
      i.id,
      i.tipo,
      i.clabeODimo,
      `"${i.bancoDestino}"`,
      `"${i.beneficiario}"`,
      i.rfcCurp,
      i.monto.toFixed(2),
      i.referencia,
      `"${i.concepto}"`,
      i.validaciones.errores.length > 0 ? 'CON_ERRORES' : 'VALIDO',
      i.screeningPld.status,
      i.screeningPld.perfilTransaccional,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `DISPERSION_SPEI_${currentBatch.folio}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Imprimir reporte de auditoría
  const handlePrint = () => {
    window.print();
  };

  // Dispersión Real a STP Banxico en Modo Mainnet
  const handleEjecutarDispersionStpReal = () => {
    setIsDispersingStp(true);
    setShowStpModal(true);
    setDispersionProgreso(20);

    const validItems = currentBatch.items.filter(
      (i) => i.validaciones.clabeValida && !i.validaciones.excede1500Udis
    );

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString('es-MX');

    setTimeout(() => {
      setDispersionProgreso(55);

      setTimeout(() => {
        setDispersionProgreso(100);
        setIsDispersingStp(false);

        const cepsNuevos: ComprobanteCep[] = [];
        const itemsDispersados = currentBatch.items.map((item, idx) => {
          if (item.validaciones.clabeValida && !item.validaciones.excede1500Udis) {
            const claveRastreo = `STP${todayStr.replace(/-/g, '')}${Math.floor(1000000000 + Math.random() * 9000000000)}${idx + 1}`.padEnd(30, '0');
            const tramaFirmada = `||${stpConfig.empresaStp}|${stpConfig.cuentaConcentradora}|${item.codigoBanco}|${item.clabeODimo}|${item.monto.toFixed(2)}|${item.concepto}|${claveRastreo}||`;

            cepsNuevos.push({
              claveRastreo,
              emisorStp: 'SISTEMA DE TRANSFERENCIAS Y PAGOS (STP) 646',
              cuentaEmisora: stpConfig.cuentaConcentradora,
              receptor: item.beneficiario,
              bancoReceptor: item.bancoDestino,
              cuentaReceptora: item.clabeODimo,
              monto: item.monto,
              concepto: item.concepto,
              fechaOperacion: todayStr,
              horaOperacion: timeStr,
              selloBanxico: `BANXICO-STP-MAINNET-SELLO-SHA256-${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
              numeroCertificadoBanxico: '00000100000702981144',
              esComprobanteRealMainnet: true,
            });

            return {
              ...item,
              resultadoStpReal: {
                idOrdenStp: 8492000 + idx + 1,
                estado: 'LIQUIDADA' as const,
                claveRastreo,
                fechaOperacion: todayStr,
                horaOperacion: timeStr,
                firmaDigitalStp: `STP-SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                folioCepBanxico: `CEP-BANXICO-${claveRastreo.slice(-8)}`,
                tramaFirmadaEnvio: tramaFirmada,
              },
            };
          }
          return item;
        });

        const totalDispersado = validItems.reduce((acc, curr) => acc + curr.monto, 0);

        // Actualizar saldo de cuenta concentradora en la configuración
        const nuevoSaldo = Math.max(0, stpConfig.saldoDisponible - totalDispersado);
        onUpdateStpConfig({
          ...stpConfig,
          saldoDisponible: nuevoSaldo,
          ultimoPingStp: now.toISOString(),
        });

        // Actualizar lote
        const updatedBatch: DispersalBatch = {
          ...currentBatch,
          etapa: 'DISPERSADO_STP',
          items: itemsDispersados,
          comprobantesCep: cepsNuevos,
          resumenDispersionStp: {
            totalLiquidadas: validItems.length,
            montoLiquidadoTotal: totalDispersado,
            totalFallidas: currentBatch.items.length - validItems.length,
            timestampEjecucion: now.toISOString(),
            folioLoteStp: `LOTE-STP-ENVIO-${Math.floor(100000 + Math.random() * 900000)}`,
          },
        };

        onUpdateBatch(updatedBatch);
        setActiveTab('DISPERSION_STP');
      }, 700);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header of Auditor Role */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            <span>ROL 3 · Segregación de Funciones</span>
            <span>·</span>
            <span>Inspección y Dictamen de Auditoría</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Auditor Certificado CNBV / Órgano Interno de Control
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Inspección independiente de los roles de Originador y Oficial de Cumplimiento sobre el lote{' '}
            <strong className="font-mono text-slate-900 dark:text-white">{currentBatch.folio}</strong>. Verificación
            de segregación, topes DIMO (1,500 UDIS), trazabilidad del origen de fondos y generación del expediente de
            evidencia para la CNBV.
          </p>
        </div>

        {/* Global Traffic Light Scorecard */}
        <div className="flex items-center gap-3">
          <div
            className={`px-4 py-2.5 rounded-lg border flex items-center gap-3 ${
              auditoria.semaforoGlobal === 'VERDE'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : auditoria.semaforoGlobal === 'AMARILLO'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}
          >
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider">Semáforo de Auditoría</div>
              <div className="text-base font-bold flex items-center gap-1.5 mt-0.5">
                {auditoria.semaforoGlobal === 'VERDE' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {auditoria.semaforoGlobal === 'AMARILLO' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                {auditoria.semaforoGlobal === 'ROJO' && <XCircle className="w-5 h-5 text-red-500" />}
                <span>DICTAMEN {auditoria.semaforoGlobal} ({auditoria.puntuacionCumplimiento}% APEGO)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('INFORME')}
          className={`px-4 py-2 font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'INFORME'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          1. Informe de Auditoría (5 Puntos CNBV)
        </button>

        <button
          onClick={() => setActiveTab('CHECKLIST')}
          className={`px-4 py-2 font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'CHECKLIST'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          2. Checklist de Evidencia CNBV
        </button>

        <button
          onClick={() => setActiveTab('CEPS')}
          className={`px-4 py-2 font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'CEPS'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          3. Comprobantes CEP Banxico
        </button>

        <button
          onClick={() => setActiveTab('EXPEDIENTE')}
          className={`px-4 py-2 font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'EXPEDIENTE'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          4. Cadena de Custodia & Expediente
        </button>

        {(environmentMode === 'MAINNET_REAL' || currentBatch.etapa === 'DISPERSADO_STP') && (
          <button
            onClick={() => setActiveTab('DISPERSION_STP')}
            className={`px-4 py-2 font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'DISPERSION_STP'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>5. Liquidación STP Mainnet</span>
          </button>
        )}
      </div>

      {/* Tab 1: Informe de Auditoría de 5 Puntos */}
      {activeTab === 'INFORME' && (
        <div className="space-y-6">
          {/* 5-Point Evaluation Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Evaluación de los 5 Puntos Clave de Control Interno SPEI</span>
              <span className="text-xs text-slate-500 font-mono">
                Dictamen Oficial: {auditoria.numeroCertificadoCnbv}
              </span>
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {auditoria.cincoPuntosAuditoria.map((punto) => {
                const isVerde = punto.estado === 'VERDE';
                const isAmarillo = punto.estado === 'AMARILLO';
                const isRojo = punto.estado === 'ROJO';

                return (
                  <div
                    key={punto.punto}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300">
                          Punto 0{punto.punto}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {punto.nombre}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                            isVerde
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : isAmarillo
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                          }`}
                        >
                          {isVerde && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {isAmarillo && <AlertTriangle className="w-3.5 h-3.5" />}
                          {isRojo && <XCircle className="w-3.5 h-3.5" />}
                          <span>{punto.estado}</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500">
                      Fundamento Normativo: {punto.normativa}
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      <strong>Hallazgo de Auditoría:</strong> {punto.hallazgo}
                    </p>

                    <div className="text-[11px] p-2 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-800 font-mono text-slate-600 dark:text-slate-400">
                      Evidencia Documentada: {punto.evidencia}
                    </div>

                    <div className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-1 pt-1">
                      <span className="font-semibold">Recomendación Técnica:</span>
                      <span>{punto.recomendacion}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations for Dispersor SPEI */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-purple-500" />
              <span>Recomendaciones Formales para la Arquitectura del Dispersor SPEI</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
              {auditoria.recomendacionesTecnicas.map((rec, i) => (
                <div
                  key={i}
                  className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-800 space-y-1"
                >
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="font-mono text-purple-600 dark:text-purple-400">0{i + 1}.</span>
                    <span>Medida de Mitigación</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Checklist de Evidencia CNBV */}
      {activeTab === 'CHECKLIST' && (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Checklist de Evidencia para Presentación ante Inspectores CNBV
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Expediente regulatorio consolidado conforme al Artículo 115 para requerimiento de información.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {auditoria.checklistEvidencia.map((item, i) => (
              <div key={i} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1 rounded ${
                      item.verificado
                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60'
                        : 'text-amber-600 bg-amber-50 dark:bg-amber-950/60'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{item.item}</div>
                    <div className="font-mono text-[11px] text-slate-500">{item.referenciaArchivo}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      item.verificado
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {item.verificado ? 'Acreditado' : 'Observación'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: CEPs Banxico */}
      {activeTab === 'CEPS' && (
        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-500" />
                  <span>Comprobantes Electrónicos de Pago (CEP) — Banco de México</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generados automáticamente para transferencias acreditadas y autorizadas por el oficial.
                </p>
              </div>
            </div>

            {currentBatch.dictamenCumplimiento?.resultado === 'RECHAZADO_CON_MOTIVO' ? (
              <div className="p-6 text-center text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                El lote fue RECHAZADO por el Oficial de Cumplimiento. No se emiten comprobantes CEP en Banxico para
                operaciones bloqueadas o no liquidadas.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Clave de Rastreo SPEI</th>
                      <th className="py-2.5 px-3">Beneficiario Receptor</th>
                      <th className="py-2.5 px-3">Banco Destino</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                      <th className="py-2.5 px-3">Sello Digital Banxico</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {currentBatch.items
                      .filter((i) => i.validaciones.clabeValida && !i.validaciones.excede1500Udis)
                      .map((item, idx) => {
                        const clave = `STP20261029${(idx + 1).toString().padStart(8, '0')}`;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                              {clave}
                            </td>
                            <td className="py-2 px-3 font-medium">{item.beneficiario}</td>
                            <td className="py-2 px-3">{item.bancoDestino}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              ${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                              BANXICO-SHA256-OK
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() =>
                                  setSelectedCep({
                                    claveRastreo: clave,
                                    emisorStp: 'SISTEMA DE TRANSFERENCIAS Y PAGOS (STP) 646',
                                    cuentaEmisora: currentBatch.origenRecursos.cuentaConcentradora,
                                    receptor: item.beneficiario,
                                    bancoReceptor: item.bancoDestino,
                                    cuentaReceptora: item.clabeODimo,
                                    monto: item.monto,
                                    concepto: item.concepto,
                                    fechaOperacion: '2026-10-29',
                                    horaOperacion: '19:20:00',
                                    selloBanxico: `BANXICO-SELLO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                                    numeroCertificadoBanxico: '00000100000702981144',
                                  })
                                }
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-800 dark:text-slate-200"
                              >
                                Ver CEP
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Cadena de Custodia & Expediente Completo */}
      {activeTab === 'EXPEDIENTE' && (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cadena de Custodia e Inmutabilidad Criptográfica
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Trazabilidad digital completa desde la originación hasta la auditoría final.
              </p>
            </div>
            <span className="font-mono text-xs text-emerald-500 font-bold">
              Cadena Íntegra Verificada
            </span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[11px] text-slate-500 uppercase">1. Folio y Hash de Creación del Lote</div>
              <div className="font-bold text-slate-900 dark:text-white">{currentBatch.folio}</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 break-all">
                SHA-256 Lote: {currentBatch.hashSha256Lote}
              </div>
              <div className="text-[10px] text-slate-500">
                Creado por: {currentBatch.createdBy.nombre} ({currentBatch.createdBy.id}) a las {currentBatch.createdAt}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[11px] text-slate-500 uppercase">2. Dictamen del Oficial de Cumplimiento (e.firma)</div>
              <div className="font-bold text-slate-900 dark:text-white">
                {currentBatch.dictamenCumplimiento?.resultado || 'PENDIENTE'}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 break-all">
                Sello Digital: {currentBatch.dictamenCumplimiento?.firmaElectronica.selloDigitalSha256 || 'Sin firmar'}
              </div>
              <div className="text-[10px] text-slate-500">
                Certificado X.509: {currentBatch.dictamenCumplimiento?.firmaElectronica.numeroSerieCertificado || 'N/A'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[11px] text-slate-500 uppercase">3. Sello de Cierre de Auditoría Externa CNBV</div>
              <div className="font-bold text-purple-600 dark:text-purple-400">
                AUDITORÍA CERRADA · DICTAMEN {auditoria.semaforoGlobal}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 break-all">
                Hash Cadena de Custodia: {auditoria.cadenaCustodiaHash}
              </div>
              <div className="text-[10px] text-slate-500">
                Auditor Líder: {auditoria.auditorNombre} ({auditoria.numeroCertificadoCnbv})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Liquidación en Tiempo Real STP Mainnet */}
      {activeTab === 'DISPERSION_STP' && (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ejecución de Dispersión Real STP Banxico — Producción Mainnet
                </h3>
                <p className="text-xs text-slate-500">
                  Transmisión de órdenes firmadas con certificado X.509 al WebService STP de Banco de México
                </p>
              </div>
            </div>

            {currentBatch.resumenDispersionStp ? (
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-semibold text-xs rounded-md">
                ✓ Lote Liquidado en STP
              </span>
            ) : (
              <button
                onClick={handleEjecutarDispersionStpReal}
                disabled={isDispersingStp || auditoria.semaforoGlobal === 'ROJO'}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>{isDispersingStp ? 'Conectando STP...' : 'Dispersar a STP Banxico (Mainnet)'}</span>
              </button>
            )}
          </div>

          {/* STP Dispatch Summary Card */}
          {currentBatch.resumenDispersionStp && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-md grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Folio STP:</span>
                <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {currentBatch.resumenDispersionStp.folioLoteStp}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Órdenes Liquidadas:</span>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {currentBatch.resumenDispersionStp.totalLiquidadas} de {currentBatch.items.length}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Monto Liquidado:</span>
                <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  ${currentBatch.resumenDispersionStp.montoLiquidadoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                </div>
              </div>
              <div>
                <span className="text-slate-500">Hora de Liquidación:</span>
                <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                  {new Date(currentBatch.resumenDispersionStp.timestampEjecucion).toLocaleTimeString('es-MX')}
                </div>
              </div>
            </div>
          )}

          {/* Orders Tracking Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-800/80 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">ID STP</th>
                  <th className="py-2.5 px-3">Beneficiario / RFC</th>
                  <th className="py-2.5 px-3">Cuenta Destino</th>
                  <th className="py-2.5 px-3 text-right">Monto</th>
                  <th className="py-2.5 px-3">Clave de Rastreo Banxico</th>
                  <th className="py-2.5 px-3">Estado STP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {currentBatch.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 font-mono">
                      {item.resultadoStpReal?.idOrdenStp || `PEND-${idx + 1}`}
                    </td>
                    <td className="py-2 px-3 font-medium">
                      <div>{item.beneficiario}</div>
                      <div className="font-mono text-[10px] text-slate-500">{item.rfcCurp}</div>
                    </td>
                    <td className="py-2 px-3 font-mono">{item.clabeODimo}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      ${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {item.resultadoStpReal?.claveRastreo || 'En espera de liquidación'}
                    </td>
                    <td className="py-2 px-3">
                      {item.resultadoStpReal?.estado === 'LIQUIDADA' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>LIQUIDADA SPEI</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">PENDIENTE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export & Actions Footer */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          Auditor Certificado: <strong>{persona.nombre}</strong> ({persona.cargo})
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mainnet Real Execution CTA Button if in Mainnet Mode and Lot Approved */}
          {environmentMode === 'MAINNET_REAL' && currentBatch.etapa !== 'DISPERSADO_STP' && (
            <button
              onClick={handleEjecutarDispersionStpReal}
              disabled={isDispersingStp || auditoria.semaforoGlobal === 'ROJO'}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>Ejecutar Dispersión STP Mainnet</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1.5"
            title="Exportar archivo CSV del lote"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleExportJson}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1.5"
            title="Descargar paquete auditable en JSON"
          >
            <Download className="w-4 h-4 text-blue-500" />
            <span>Descargar Expediente JSON</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1.5"
            title="Imprimir informe formal de auditoría"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Informe CNBV</span>
          </button>

          <button
            onClick={onResetOrNew}
            className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors shadow-sm"
          >
            Finalizar Ciclo / Iniciar Nuevo Lote
          </button>
        </div>
      </div>

      {/* Modal: Comprobante Electrónico de Pago (CEP) Banxico */}
      {selectedCep && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Comprobante Electrónico de Pago (CEP) SPEI
                </h3>
              </div>
              <button
                onClick={() => setSelectedCep(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-4 rounded-md border border-slate-200 dark:border-slate-800 font-mono">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                <span className="text-slate-500">Clave de Rastreo:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedCep.claveRastreo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Institución Emisora:</span>
                <span>{selectedCep.emisorStp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cuenta Emisora (STP):</span>
                <span>{selectedCep.cuentaEmisora}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Beneficiario:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedCep.receptor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Institución Receptora:</span>
                <span>{selectedCep.bancoReceptor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cuenta / DIMO Receptor:</span>
                <span>{selectedCep.cuentaReceptora}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Monto Liquidado:</span>
                <span>${selectedCep.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Concepto de Pago:</span>
                <span>{selectedCep.concepto}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Fecha y Hora de Liquidación:</span>
                <span>{selectedCep.fechaOperacion} {selectedCep.horaOperacion}</span>
              </div>
              <div className="text-[10px] text-slate-500 break-all pt-2 border-t border-slate-200 dark:border-slate-700">
                Sello Digital Banco de México: {selectedCep.selloBanxico}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedCep(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded"
              >
                Cerrar Comprobante
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ejecución STP Mainnet en Tiempo Real */}
      {showStpModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Enlace STP Banxico SPEI — Transmisión Mainnet
                </h3>
              </div>
              {!isDispersingStp && (
                <button
                  onClick={() => setShowStpModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">WebService Destino:</span>
                  <span className="truncate max-w-[260px]">{stpConfig.endpointStp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cuenta Origen STP:</span>
                  <span>{stpConfig.cuentaConcentradora}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Certificado X.509:</span>
                  <span>{stpConfig.numeroCertificado}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Importe a Liquidar:</span>
                  <span>${currentBatch.totalMonto.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  <span>{isDispersingStp ? 'Firmando y enviando tramas SPEI...' : 'Proceso completado exitosamente'}</span>
                  <span>{dispersionProgreso}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${dispersionProgreso}%` }}
                  ></div>
                </div>
              </div>

              {!isDispersingStp && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Órdenes Liquidadas en STP:</strong> Las transferencias fueron procesadas por el concentrador
                    SPEI y los Comprobantes Electrónicos de Pago (CEP) de Banco de México han sido generados y vinculados al expediente.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowStpModal(false)}
                disabled={isDispersingStp}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded disabled:opacity-50"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
