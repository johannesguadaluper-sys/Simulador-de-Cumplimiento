import React, { useState } from 'react';
import { DispersalBatch, DispersalItem, UserPersona, EnvironmentMode, StpProductionConfig } from '../types/spei';
import {
  validarClabeInterbancaria,
  validarDimo,
  detectarDatoPotencialmenteReal,
  validarRfcMexicano,
  TOPE_DIMO_UDIS,
  VALOR_UDI_DEFAULT,
  MTU_CORPORATIVO_DEFAULT,
  generarLoteEjemplo,
  generarLoteMainnetReal,
  generarSha256,
} from '../utils/speiValidation';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Building2,
  HelpCircle,
  Sparkles,
  Server,
  Wallet,
} from 'lucide-react';

interface OriginatorViewProps {
  currentBatch: DispersalBatch;
  onUpdateBatch: (batch: DispersalBatch) => void;
  onAdvanceToCompliance: () => void;
  persona: UserPersona;
  onOpenCalculator: () => void;
  environmentMode: EnvironmentMode;
  onToggleEnvironment: () => void;
  stpConfig: StpProductionConfig;
  onOpenStpConsole: () => void;
}

export const OriginatorView: React.FC<OriginatorViewProps> = ({
  currentBatch,
  onUpdateBatch,
  onAdvanceToCompliance,
  persona,
  onOpenCalculator,
  environmentMode,
  onToggleEnvironment,
  stpConfig,
  onOpenStpConsole,
}) => {
  const [udiValor, setUdiValor] = useState<number>(currentBatch.udiValorAplicado || VALOR_UDI_DEFAULT);
  const [mtu, setMtu] = useState<number>(currentBatch.mtuAplicado || MTU_CORPORATIVO_DEFAULT);
  const [showNewRowModal, setShowNewRowModal] = useState<boolean>(false);
  const [rawCsvInput, setRawCsvInput] = useState<string>('');
  const [showCsvModal, setShowCsvModal] = useState<boolean>(false);

  // Bitácora de origen de fondos state
  const [origenFuente, setOrigenFuente] = useState<string>(currentBatch.origenRecursos.fuente);
  const [uuidFactura, setUuidFactura] = useState<string>(currentBatch.origenRecursos.uuidFacturaSat);
  const [centroCostos, setCentroCostos] = useState<string>(currentBatch.origenRecursos.centroCostos);
  const [cuentaConcentradora, setCuentaConcentradora] = useState<string>(
    currentBatch.origenRecursos.cuentaConcentradora
  );
  const [justificacion, setJustificacion] = useState<string>(currentBatch.origenRecursos.justificacionEconomica);

  // New item form
  const [newItem, setNewItem] = useState<{
    tipo: 'SPEI' | 'DIMO';
    clabeODimo: string;
    beneficiario: string;
    rfcCurp: string;
    monto: string;
    referencia: string;
    concepto: string;
  }>({
    tipo: 'SPEI',
    clabeODimo: '',
    beneficiario: 'TEST_009_BENEFICIARIO_NUEVO',
    rfcCurp: 'TEST_RFC_990101AA1',
    monto: '15000',
    referencia: '1002003',
    concepto: 'PAGO PROVEEDOR SINTETICO TEST',
  });

  const topeDimoMxn = TOPE_DIMO_UDIS * udiValor;

  // Revalidar un elemento
  const validateItem = (
    itemData: {
      tipo: 'SPEI' | 'DIMO';
      clabeODimo: string;
      beneficiario: string;
      rfcCurp: string;
      monto: number;
      referencia: string;
      concepto: string;
    }
  ): DispersalItem['validaciones'] => {
    const errores: string[] = [];
    const advertencias: string[] = [];

    let rfcValidoSat = true;

    // Validación según entorno: Mainnet Real vs Sandbox Sintético
    if (environmentMode === 'MAINNET_REAL') {
      const rfcRes = validarRfcMexicano(itemData.rfcCurp);
      rfcValidoSat = rfcRes.valido;
      if (!rfcRes.valido) {
        errores.push(`RFC Inválido SAT: ${rfcRes.motivo}`);
      }
      if (itemData.beneficiario.includes('TEST_')) {
        advertencias.push('Modo Mainnet: Evite prefijos ficticios TEST_ en nombres reales de beneficiarios.');
      }
      if (itemData.monto > stpConfig.saldoDisponible) {
        advertencias.push(`Atención: El monto supera el saldo disponible actual en STP ($${stpConfig.saldoDisponible.toLocaleString('es-MX')} MXN).`);
      }
    } else {
      // Validar regla inquebrantable de datos sintéticos en Sandbox
      const datoReal = detectarDatoPotencialmenteReal({
        beneficiario: itemData.beneficiario,
        rfcCurp: itemData.rfcCurp,
        clabeODimo: itemData.clabeODimo,
      });
      if (datoReal.esReal && datoReal.advertencia) {
        advertencias.push(datoReal.advertencia);
      }
    }

    let clabeValida = true;
    let digitoCalculado = 0;
    let dimoValido = true;
    let excede1500Udis = false;
    let excedeMtu = false;

    if (itemData.tipo === 'SPEI') {
      const clabeRes = validarClabeInterbancaria(itemData.clabeODimo);
      clabeValida = clabeRes.valida;
      digitoCalculado = clabeRes.digitoCalculado;
      if (!clabeRes.valida) {
        errores.push(`CLABE Inválida: ${clabeRes.motivo || 'Formato incorrecto'}`);
      }
      if (itemData.monto > mtu) {
        excedeMtu = true;
        errores.push(
          `Supera MTU: Monto $${itemData.monto.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
          })} excede el MTU corporativo de $${mtu.toLocaleString('es-MX')}.00 MXN.`
        );
      }
    } else {
      // DIMO
      const dimoRes = validarDimo(itemData.clabeODimo);
      dimoValido = dimoRes.valida;
      if (!dimoRes.valida) {
        errores.push(`DIMO Inválido: ${dimoRes.motivo}`);
      }
      if (itemData.monto > topeDimoMxn) {
        excede1500Udis = true;
        errores.push(
          `Tope DIMO Excedido: $${itemData.monto.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
          })} MXN supera el límite legal de 1,500 UDIS ($${topeDimoMxn.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
          })} MXN). Debe dispersarse por SPEI.`
        );
      }
    }

    if (itemData.referencia.length > 7 || !/^\d+$/.test(itemData.referencia)) {
      errores.push('La Referencia Numérica en SPEI debe ser numérica de hasta 7 dígitos.');
    }
    if (itemData.concepto.length === 0 || itemData.concepto.length > 40) {
      errores.push('El Concepto de Pago debe tener entre 1 y 40 caracteres alfanuméricos.');
    }

    return {
      clabeValida,
      digitoVerificadorCalculado: digitoCalculado,
      dimoValido,
      excede1500Udis,
      excedeMtu,
      esDatoPotencialmenteReal: environmentMode === 'MAINNET_REAL',
      rfcValidoSat,
      errores,
      advertencias,
    };
  };

  // Cargar plantilla sintética
  const handleLoadTemplate = (tipo: 'NOMINA_LIMPIA' | 'ALERTA_DIMO' | 'ALERTA_PLD_LISTAS' | 'EXCESO_MTU') => {
    const nuevoLote = generarLoteEjemplo(tipo, udiValor, mtu);
    onUpdateBatch(nuevoLote);
  };

  // Eliminar un item
  const handleDeleteItem = (id: string) => {
    const updatedItems = currentBatch.items.filter((i) => i.id !== id);
    const totalMonto = updatedItems.reduce((acc, curr) => acc + curr.monto, 0);
    onUpdateBatch({
      ...currentBatch,
      items: updatedItems,
      totalMonto,
      totalItems: updatedItems.length,
    });
  };

  // Agregar nuevo item manual
  const handleAddItem = () => {
    const montoNum = parseFloat(newItem.monto) || 0;
    const validaciones = validateItem({
      tipo: newItem.tipo,
      clabeODimo: newItem.clabeODimo,
      beneficiario: newItem.beneficiario,
      rfcCurp: newItem.rfcCurp,
      monto: montoNum,
      referencia: newItem.referencia,
      concepto: newItem.concepto,
    });

    let bancoDestino = 'DIMO BANXICO (DINERO MÓVIL)';
    let codigoBanco = 'DIMO';
    if (newItem.tipo === 'SPEI') {
      const res = validarClabeInterbancaria(newItem.clabeODimo);
      bancoDestino = res.bancoNombre;
      codigoBanco = res.bancoCodigo;
    }

    const item: DispersalItem = {
      id: `ITEM-TEST-${Math.floor(100 + Math.random() * 900)}`,
      tipo: newItem.tipo,
      clabeODimo: newItem.clabeODimo.trim(),
      bancoDestino,
      codigoBanco,
      beneficiario: newItem.beneficiario.trim(),
      rfcCurp: newItem.rfcCurp.trim(),
      monto: montoNum,
      referencia: newItem.referencia.trim(),
      concepto: newItem.concepto.trim(),
      cuentaOrigen: cuentaConcentradora,
      institucionOrigen: '646 - STP BANXICO',
      validaciones,
      screeningPld: {
        status: 'SIN_COINCIDENCIA',
        perfilTransaccional: montoNum > 100000 ? 'INUSUAL' : 'HABITUAL',
        montoPerfilDeclarado: 80000,
        kycVigente: true,
        expedienteDoc: {
          ineVigente: true,
          comprobanteDomicilioMenor90d: true,
          cifSat: true,
          beneficiarioFinalUbo: true,
        },
        accionPld: 'LIBERAR',
      },
    };

    const updatedItems = [...currentBatch.items, item];
    const totalMonto = updatedItems.reduce((acc, curr) => acc + curr.monto, 0);
    onUpdateBatch({
      ...currentBatch,
      items: updatedItems,
      totalMonto,
      totalItems: updatedItems.length,
    });

    setShowNewRowModal(false);
  };

  // Carga Masiva por CSV
  const handleProcessCsv = () => {
    if (!rawCsvInput.trim()) return;
    const lines = rawCsvInput.trim().split('\n');
    const newItems: DispersalItem[] = [];

    lines.forEach((line, idx) => {
      // Formato: TIPO, CLABE_O_DIMO, BENEFICIARIO, RFC, MONTO, REFERENCIA, CONCEPTO
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 6) {
        const tipo = parts[0].toUpperCase() === 'DIMO' ? 'DIMO' : 'SPEI';
        const clabeODimo = parts[1];
        const beneficiario = parts[2] || `TEST_${idx + 1}_BENEFICIARIO`;
        const rfcCurp = parts[3] || `TEST_RFC_${idx + 1}`;
        const monto = parseFloat(parts[4]) || 1000;
        const referencia = parts[5] || '1234567';
        const concepto = parts[6] || 'DISPERSION PRUEBA TEST';

        const validaciones = validateItem({
          tipo,
          clabeODimo,
          beneficiario,
          rfcCurp,
          monto,
          referencia,
          concepto,
        });

        let bancoDestino = 'DIMO BANXICO';
        let codigoBanco = 'DIMO';
        if (tipo === 'SPEI') {
          const res = validarClabeInterbancaria(clabeODimo);
          bancoDestino = res.bancoNombre;
          codigoBanco = res.bancoCodigo;
        }

        newItems.push({
          id: `ITEM-CSV-${idx + 1}-${Math.floor(100 + Math.random() * 900)}`,
          tipo,
          clabeODimo,
          bancoDestino,
          codigoBanco,
          beneficiario,
          rfcCurp,
          monto,
          referencia,
          concepto,
          cuentaOrigen: cuentaConcentradora,
          institucionOrigen: '646 - STP BANXICO',
          validaciones,
          screeningPld: {
            status: 'SIN_COINCIDENCIA',
            perfilTransaccional: 'HABITUAL',
            montoPerfilDeclarado: 50000,
            kycVigente: true,
            expedienteDoc: {
              ineVigente: true,
              comprobanteDomicilioMenor90d: true,
              cifSat: true,
              beneficiarioFinalUbo: true,
            },
            accionPld: 'LIBERAR',
          },
        });
      }
    });

    if (newItems.length > 0) {
      const updated = [...currentBatch.items, ...newItems];
      onUpdateBatch({
        ...currentBatch,
        items: updated,
        totalMonto: updated.reduce((a, b) => a + b.monto, 0),
        totalItems: updated.length,
      });
      setShowCsvModal(false);
      setRawCsvInput('');
    }
  };

  // Guardar bitácora de origen de fondos y sellar lote
  const handleConsolidateBatch = async () => {
    const batchJson = JSON.stringify({
      folio: currentBatch.folio,
      createdBy: persona.id,
      origen: {
        fuente: origenFuente,
        uuidFactura,
        centroCostos,
        cuentaConcentradora,
        justificacion,
      },
      items: currentBatch.items.map((i) => ({
        id: i.id,
        monto: i.monto,
        clabe: i.clabeODimo,
      })),
    });

    const hash = await generarSha256(batchJson);

    onUpdateBatch({
      ...currentBatch,
      origenRecursos: {
        fuente: origenFuente,
        uuidFacturaSat: uuidFactura,
        centroCostos,
        cuentaConcentradora,
        justificacionEconomica: justificacion,
      },
      mtuAplicado: mtu,
      udiValorAplicado: udiValor,
      topeDimoMxn,
      hashSha256Lote: hash,
    });

    // Avanzar a cumplimiento
    onAdvanceToCompliance();
  };

  const totalErrores = currentBatch.items.reduce((sum, item) => sum + item.validaciones.errores.length, 0);
  const totalAdvertencias = currentBatch.items.reduce(
    (sum, item) => sum + item.validaciones.advertencias.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Role Title & Objective */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            <span>ROL 1 · Segregación de Funciones</span>
            <span>·</span>
            <span>Originador de Pagos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Administrador Corporativo — Dispersión de Lotes SPEI / DIMO
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Cargue, valide formatos de CLABE (18 dígitos) y DIMO (10 dígitos), verifique el tope legal de 1,500 UDIS y
            el MTU corporativo, y documente el origen de los recursos conforme al Artículo 115 de la CNBV.
          </p>
        </div>

        {/* Presets and Environment Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {environmentMode === 'MAINNET_REAL' ? (
            <>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Modo Producción Mainnet:</span>
              </span>
              <button
                onClick={() => {
                  const loteMainnet = generarLoteMainnetReal(udiValor, mtu);
                  onUpdateBatch(loteMainnet);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Cargar Lote Proveedores Reales</span>
              </button>
              <button
                onClick={onOpenStpConsole}
                className="px-3 py-1.5 text-xs font-medium rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Consola STP: ${stpConfig.saldoDisponible.toLocaleString('es-MX')}</span>
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-400 font-medium">Entrenamiento Aspirantes (Sandbox):</span>
              <button
                onClick={() => handleLoadTemplate('NOMINA_LIMPIA')}
                className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Lote Limpio TEST
              </button>
              <button
                onClick={() => handleLoadTemplate('ALERTA_DIMO')}
                className="px-2.5 py-1.5 text-xs font-medium rounded border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
              >
                Alerta DIMO &gt; 1500 UDIS
              </button>
              <button
                onClick={() => handleLoadTemplate('ALERTA_PLD_LISTAS')}
                className="px-2.5 py-1.5 text-xs font-medium rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                Alerta OFAC / SAT 69-B
              </button>
              <button
                onClick={() => handleLoadTemplate('EXCESO_MTU')}
                className="px-2.5 py-1.5 text-xs font-medium rounded border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
              >
                Exceso MTU
              </button>
            </>
          )}
        </div>
      </div>

      {/* Control Strip: UDI Banxico, MTU, and Batch Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Folio del Lote */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Folio de Lote Generado
          </div>
          <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {currentBatch.folio}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="font-mono text-[11px]">Etapa: {currentBatch.etapa}</span>
          </div>
        </div>

        {/* KPI 2: Importe Total Dispersión */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Monto Total Lote ({currentBatch.totalItems} registros)
          </div>
          <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            ${currentBatch.totalMonto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cuenta STP: <span className="font-mono">{cuentaConcentradora.slice(0, 7)}...</span>
          </div>
        </div>

        {/* KPI 3: Límite DIMO 1,500 UDIS */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tope DIMO (1,500 UDIS)
            </span>
            <button
              onClick={onOpenCalculator}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ajustar UDI
            </button>
          </div>
          <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            ${topeDimoMxn.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Valor UDI: <span className="font-mono">${udiValor.toFixed(4)}</span> MXN / UDI
          </div>
        </div>

        {/* KPI 4: MTU Corporativo */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            MTU Unitario Autorizado
          </div>
          <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            ${mtu.toLocaleString('es-MX')}.00 MXN
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Por transferencia unitaria SPEI
          </div>
        </div>
      </div>

      {/* Bitácora de Origen de Fondos (CNBV Art. 115) */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Bitácora de Origen de Fondos (Exigencia Obligatoria CNBV Art. 115)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Trazabilidad Financiera Obligatoria para Auditoría
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              ¿Origen del Recurso / Fuente Financiera?
            </label>
            <input
              type="text"
              value={origenFuente}
              onChange={(e) => setOrigenFuente(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Ej. Cobranza de Clientes Cta STP"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Contrato o Factura CFDI Asociada (UUID SAT)
            </label>
            <input
              type="text"
              value={uuidFactura}
              onChange={(e) => setUuidFactura(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="TEST-UUID-XXXX-XXXX"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Centro de Costos / Proyecto
            </label>
            <input
              type="text"
              value={centroCostos}
              onChange={(e) => setCentroCostos(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="CC-TESORERIA-804"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Cuenta Origen STP Banxico (CLABE 18d)
            </label>
            <input
              type="text"
              value={cuentaConcentradora}
              onChange={(e) => setCuentaConcentradora(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="646180112233445561"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1 text-xs">
            Justificación Económica de la Dispersión
          </label>
          <textarea
            rows={2}
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Describa la causa contractual y económica para la dispersión..."
          />
        </div>
      </div>

      {/* Items Table Header & Action Buttons */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Registros del Lote para Dispersión SPEI / DIMO
            </h3>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span>{currentBatch.items.length} transferencias programadas</span>
              <span>·</span>
              {totalErrores > 0 ? (
                <span className="text-red-500 font-semibold">{totalErrores} errores de validación</span>
              ) : (
                <span className="text-emerald-500 font-medium">Validación técnica conforme</span>
              )}
              {totalAdvertencias > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-500">{totalAdvertencias} advertencias de datos sintéticos</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCsvModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Carga Masiva CSV</span>
            </button>
            <button
              onClick={() => setShowNewRowModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Registro</span>
            </button>
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">CLABE / Cel DIMO</th>
                <th className="py-2.5 px-3">Institución Destino</th>
                <th className="py-2.5 px-3">Beneficiario (Sintético)</th>
                <th className="py-2.5 px-3">RFC / CURP</th>
                <th className="py-2.5 px-3 text-right">Monto (MXN)</th>
                <th className="py-2.5 px-3">Concepto / Ref</th>
                <th className="py-2.5 px-3">Estado Validación</th>
                <th className="py-2.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {currentBatch.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No hay registros cargados. Use los botones de plantillas superiores o cargue un CSV.
                  </td>
                </tr>
              ) : (
                currentBatch.items.map((item) => {
                  const hasErrors = item.validaciones.errores.length > 0;
                  const hasWarnings = item.validaciones.advertencias.length > 0;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2 px-3 font-semibold">
                        <span
                          className={
                            item.tipo === 'DIMO'
                              ? 'text-cyan-600 dark:text-cyan-400'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }
                        >
                          {item.tipo}
                        </span>
                      </td>

                      <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap">
                        {item.clabeODimo}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-white truncate max-w-[160px]">
                          {item.bancoDestino}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Cód: {item.codigoBanco}
                        </div>
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                        {item.beneficiario}
                      </td>

                      <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap">
                        {item.rfcCurp}
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums text-slate-900 dark:text-white">
                        ${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-2 px-3">
                        <div className="truncate max-w-[150px]">{item.concepto}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Ref: {item.referencia}</div>
                      </td>

                      <td className="py-2 px-3">
                        {hasErrors ? (
                          <div className="space-y-1">
                            {item.validaciones.errores.map((err, i) => (
                              <div
                                key={i}
                                className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1 max-w-[220px]"
                              >
                                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        ) : hasWarnings ? (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1 max-w-[220px]">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{item.validaciones.advertencias[0]}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Válido Banxico / STP</span>
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Invariant #1 Compliance Warning Box if real data detected */}
        {totalAdvertencias > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>Regla Inviolable de Cumplimiento #1:</strong> Se detectaron identificadores que no cumplen la
              nomenclatura sintética <code>TEST_xxx</code>. En el Laboratorio de Cumplimiento no se admiten datos reales
              de contribuyentes para evitar filtraciones de secreto bancario y fiscal (Art. 115).
            </div>
          </div>
        )}

        {/* Originator Confirmation Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            <div>
              Originador responsable: <strong>{persona.nombre}</strong> ({persona.cargo})
            </div>
            <div className="font-mono text-[11px]">Sello de Sesión: {persona.certificadoId}</div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleConsolidateBatch}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Consolidar Lote {currentBatch.folio} y Pasar a Rol 2: Cumplimiento</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Manual Add Item */}
      {showNewRowModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Agregar Transferencia Sintética al Lote
              </h3>
              <button
                onClick={() => setShowNewRowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Tipo de Transferencia
                  </label>
                  <select
                    value={newItem.tipo}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        tipo: e.target.value as 'SPEI' | 'DIMO',
                        clabeODimo:
                          e.target.value === 'DIMO' ? '5512345678' : '012180001234567897',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  >
                    <option value="SPEI">SPEI (CLABE 18 dígitos)</option>
                    <option value="DIMO">DIMO (Celular 10 dígitos - Máx 1,500 UDIS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    {newItem.tipo === 'SPEI' ? 'CLABE Interbancaria (18d)' : 'Número Celular DIMO (10d)'}
                  </label>
                  <input
                    type="text"
                    value={newItem.clabeODimo}
                    onChange={(e) => setNewItem({ ...newItem, clabeODimo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-mono"
                    placeholder={newItem.tipo === 'SPEI' ? '012180001234567897' : '5512345678'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Beneficiario (Ficticio TEST_xxx)
                  </label>
                  <input
                    type="text"
                    value={newItem.beneficiario}
                    onChange={(e) => setNewItem({ ...newItem, beneficiario: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    RFC / CURP (Ficticio TEST_xxx)
                  </label>
                  <input
                    type="text"
                    value={newItem.rfcCurp}
                    onChange={(e) => setNewItem({ ...newItem, rfcCurp: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Monto (MXN)
                  </label>
                  <input
                    type="number"
                    value={newItem.monto}
                    onChange={(e) => setNewItem({ ...newItem, monto: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Referencia (7d)
                  </label>
                  <input
                    type="text"
                    maxLength={7}
                    value={newItem.referencia}
                    onChange={(e) => setNewItem({ ...newItem, referencia: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Concepto (máx 40)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={newItem.concepto}
                    onChange={(e) => setNewItem({ ...newItem, concepto: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowNewRowModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Agregar al Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: CSV Ingestion */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Carga Masiva de Archivo Esparcidor (CSV)
              </h3>
              <button
                onClick={() => setShowCsvModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                Pegue o escriba los registros en formato separado por comas (CSV).
                <br />
                <span className="font-mono text-[11px] text-slate-500">
                  Formato: TIPO (SPEI/DIMO), CLABE_O_CEL, BENEFICIARIO, RFC, MONTO, REFERENCIA, CONCEPTO
                </span>
              </p>

              <textarea
                rows={6}
                value={rawCsvInput}
                onChange={(e) => setRawCsvInput(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                placeholder={`SPEI, 012180001234567897, TEST_010_PEDRO_SANCHEZ, TEST_SAP8001019X1, 14200, 1004005, PAGO FACTURA TEST
DIMO, 5543219876, TEST_011_ANA_TORRES, TEST_TOA9103048Y2, 6500, 2005006, REEMBOLSO CAJA CHICA DIMO`}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowCsvModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleProcessCsv}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Procesar e Incorporar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
