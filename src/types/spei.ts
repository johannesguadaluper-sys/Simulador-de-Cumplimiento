export type AppRole = 'ORIGINADOR' | 'CUMPLIMIENTO' | 'AUDITOR';

export type EnvironmentMode = 'SANDBOX_SYNTHETIC' | 'MAINNET_REAL';

export interface UserPersona {
  role: AppRole;
  id: string;
  nombre: string;
  cargo: string;
  departamento: string;
  certificadoId: string;
  ipSimulada: string;
}

export interface StpProductionConfig {
  empresaStp: string; // e.g. "CORP_SERVICIOS_FINANCIEROS_SA"
  cuentaConcentradora: string; // CLABE 18 dígitos STP 646...
  saldoDisponible: number; // MXN disponible en cuenta concentradora
  saldoRetenido: number; // MXN
  endpointStp: string; // e.g. "https://enlace.stp.com.mx/speiws/rest/ordenPago/registra"
  ambiente: 'PRODUCCION' | 'PRODUCCION_DEMO';
  certificadoPem: string;
  numeroCertificado: string;
  llavePrivadaCargada: boolean;
  webhookCepUrl: string;
  ultimoPingStp: string;
  estadoConexion: 'CONECTADO_ACTIVO' | 'DESCONECTADO' | 'VALIDANDO';
}

export interface ResultadoStpReal {
  idOrdenStp: number;
  estado: 'LIQUIDADA' | 'EN_PROCESO' | 'DEVUELTA' | 'CANCELADA';
  claveRastreo: string;
  fechaOperacion: string;
  horaOperacion: string;
  firmaDigitalStp: string;
  folioCepBanxico?: string;
  tramaFirmadaEnvio: string;
}

export interface DispersalItem {
  id: string;
  tipo: 'SPEI' | 'DIMO';
  clabeODimo: string; // 18 dígitos para SPEI o 10 para DIMO
  bancoDestino: string;
  codigoBanco: string;
  beneficiario: string; // Synthetic e.g. TEST_001_JUAN_PEREZ o Real en Mainnet
  rfcCurp: string; // Synthetic o RFC real SAT
  monto: number;
  referencia: string; // Hasta 7 dígitos
  concepto: string; // Hasta 40 caracteres
  cuentaOrigen: string; // CLABE STP 18 dígitos
  institucionOrigen: string;
  validaciones: {
    clabeValida: boolean;
    digitoVerificadorCalculado: number;
    dimoValido: boolean;
    excede1500Udis: boolean;
    excedeMtu: boolean;
    esDatoPotencialmenteReal: boolean;
    rfcValidoSat?: boolean;
    errores: string[];
    advertencias: string[];
  };
  screeningPld: {
    status: 'SIN_COINCIDENCIA' | 'COINCIDENCIA' | 'PENDIENTE';
    listaCoincidencia?: 'OFAC_SDN' | 'SAT_69B' | 'UIF_BLOQUEADAS' | 'PEP_MUNDIAL';
    porcentajeHomonimia?: number;
    detalleAlerta?: string;
    perfilTransaccional: 'HABITUAL' | 'MODERADO' | 'INUSUAL';
    montoPerfilDeclarado: number;
    kycVigente: boolean;
    expedienteDoc: {
      ineVigente: boolean;
      comprobanteDomicilioMenor90d: boolean;
      cifSat: boolean;
      beneficiarioFinalUbo: boolean;
    };
    accionPld: 'LIBERAR' | 'SOLICITAR_ACLARACION' | 'REPORTAR_ROI' | 'BLOQUEAR';
    notaAclaratoria?: string;
  };
  resultadoStpReal?: ResultadoStpReal;
}

export interface OrigenRecursos {
  fuente: string; // e.g. "Cobranza de Clientes Concentradora STP"
  uuidFacturaSat: string; // e.g. "TEST-UUID-4F8A-92BC-73E1B9A" o UUID real
  centroCostos: string; // e.g. "CC-TESORERIA-804"
  cuentaConcentradora: string; // CLABE
  justificacionEconomica: string;
}

export interface DictamenCumplimiento {
  fechaHora: string;
  oficialId: string;
  oficialNombre: string;
  oficialCertificadoCnbv: string;
  resultado: 'APROBADO_CON_DOCUMENTACION' | 'RECHAZADO_CON_MOTIVO' | 'APROBADO_CONDICIONADO';
  motivoJustificacion: string;
  reportesEmitidos: {
    tipo: 'NINGUNO' | 'ROI_INUSUAL' | 'ROIP_INTERNA' | 'REPORTE_24H_BLOQUEO';
    folioSitiPld: string;
    descripcion: string;
    fechaGeneracion: string;
  }[];
  firmaElectronica: {
    numeroSerieCertificado: string;
    cadenaOriginal: string;
    selloDigitalSha256: string;
    algoritmo: string;
    timestamp: string;
  };
}

export interface AuditoriaPunto {
  punto: number;
  nombre: string;
  normativa: string;
  estado: 'VERDE' | 'AMARILLO' | 'ROJO';
  hallazgo: string;
  evidencia: string;
  recomendacion: string;
}

export interface AuditoriaCnbv {
  fechaHora: string;
  auditorId: string;
  auditorNombre: string;
  numeroCertificadoCnbv: string;
  semaforoGlobal: 'VERDE' | 'AMARILLO' | 'ROJO';
  puntuacionCumplimiento: number; // 0 - 100
  cincoPuntosAuditoria: AuditoriaPunto[];
  recomendacionesTecnicas: string[];
  checklistEvidencia: {
    item: string;
    verificado: boolean;
    referenciaArchivo: string;
  }[];
  cadenaCustodiaHash: string;
}

export interface ComprobanteCep {
  claveRastreo: string;
  emisorStp: string;
  cuentaEmisora: string;
  receptor: string;
  bancoReceptor: string;
  cuentaReceptora: string;
  monto: number;
  concepto: string;
  fechaOperacion: string;
  horaOperacion: string;
  selloBanxico: string;
  numeroCertificadoBanxico: string;
  esComprobanteRealMainnet?: boolean;
}

export interface DispersalBatch {
  folio: string; // LOTE-TEST-2026-XXXX o LOTE-MAINNET-2026-XXXX
  ambienteLote: EnvironmentMode;
  createdAt: string;
  createdBy: {
    id: string;
    nombre: string;
    cargo: string;
    ip: string;
    token: string;
  };
  origenRecursos: OrigenRecursos;
  mtuAplicado: number; // e.g. 250000
  udiValorAplicado: number; // e.g. 8.4523
  topeDimoUdis: number; // 1500
  topeDimoMxn: number; // 1500 * 8.4523
  items: DispersalItem[];
  totalMonto: number;
  totalItems: number;
  hashSha256Lote: string;
  etapa: 'ORIGINADO' | 'DICTAMINADO' | 'AUDITADO' | 'DISPERSADO_STP' | 'RECHAZADO';
  dictamenCumplimiento?: DictamenCumplimiento;
  auditoriaCnbv?: AuditoriaCnbv;
  comprobantesCep?: ComprobanteCep[];
  resumenDispersionStp?: {
    totalLiquidadas: number;
    montoLiquidadoTotal: number;
    totalFallidas: number;
    timestampEjecucion: string;
    folioLoteStp: string;
  };
}
