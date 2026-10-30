import { DispersalItem, DispersalBatch, UserPersona } from '../types/spei';

// Default constants
export const VALOR_UDI_DEFAULT = 8.4523; // MXN por UDI
export const TOPE_DIMO_UDIS = 1500; // 1,500 UDIS límite Banxico
export const MTU_CORPORATIVO_DEFAULT = 250000; // $250,000 MXN

// Catálogo de Códigos de Institución Financiera (Banxico SPEI)
export const BANXICO_BANCOS: Record<string, string> = {
  '002': 'BANAMEX (Banco Nacional de México)',
  '012': 'BBVA MÉXICO',
  '014': 'SANTANDER MÉXICO',
  '021': 'HSBC MÉXICO',
  '030': 'BANBAJÍO',
  '036': 'INBURSA',
  '042': 'MIFEL',
  '044': 'SCOTIABANK INVERLAT',
  '058': 'BANREGIO',
  '072': 'BANORTE',
  '127': 'BANCO AZTECA',
  '137': 'BANCOPPEL',
  '138': 'ABC CAPITAL',
  '140': 'COMPARTAMOS BANCO',
  '145': 'MERCADO PAGO WALLET',
  '646': 'STP (SISTEMA DE TRANSFERENCIAS Y PAGOS)',
  '846': 'STP (SERVICIOS TRANSACCIONALES)',
  '901': 'CLS BANK INTERNATIONAL',
  '902': 'INDEVAL',
};

export const PERSONAS_PREDETERMINADAS: Record<'ORIGINADOR' | 'CUMPLIMIENTO' | 'AUDITOR', UserPersona> = {
  ORIGINADOR: {
    role: 'ORIGINADOR',
    id: 'USR-ORIG-01',
    nombre: 'Lic. Carlos Méndez',
    cargo: 'Administrador Corporativo de Tesorería',
    departamento: 'Tesorería y Operaciones Financieras',
    certificadoId: 'CERT-ORIG-SAT-7731A',
    ipSimulada: '192.168.10.42 (VLAN Segura Tesorería)',
  },
  CUMPLIMIENTO: {
    role: 'CUMPLIMIENTO',
    id: 'USR-PLD-02',
    nombre: 'Mtra. Sofía Ramírez',
    cargo: 'Oficial de Cumplimiento Certificado CNBV',
    departamento: 'Dirección de Prevención de Lavado de Dinero (PLD/FT)',
    certificadoId: 'CERT-CNBV-PLD-2024-9982',
    ipSimulada: '192.168.20.15 (VLAN Segura Cumplimiento)',
  },
  AUDITOR: {
    role: 'AUDITOR',
    id: 'USR-AUD-03',
    nombre: 'C.P. Roberto Garza',
    cargo: 'Auditor Externo Líder Certificado CNBV',
    departamento: 'Firma de Auditoría Regulatoria y Dictamen',
    certificadoId: 'CERT-CNBV-AUD-2023-4107',
    ipSimulada: '10.0.15.88 (Subred Inspección Externa CNBV)',
  },
};

/**
 * Algoritmo oficial de dígito verificador de CLABE Interbancaria (Banco de México)
 * Pesos ponderados: 3, 7, 1 repetidos en las primeras 17 posiciones
 */
export function calcularDigitoVerificadorClabe(clabe17: string): number {
  if (clabe17.length < 17) return -1;
  const pesos = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const digito = parseInt(clabe17.charAt(i), 10);
    if (isNaN(digito)) return -1;
    suma += (digito * pesos[i]) % 10;
  }
  return (10 - (suma % 10)) % 10;
}

export function validarClabeInterbancaria(clabe: string): {
  valida: boolean;
  bancoCodigo: string;
  bancoNombre: string;
  digitoCalculado: number;
  digitoRecibido: number;
  motivo?: string;
} {
  const clean = clabe.trim().replace(/\s+/g, '');
  if (!/^\d{18}$/.test(clean)) {
    return {
      valida: false,
      bancoCodigo: clean.slice(0, 3),
      bancoNombre: 'Formato inválido (debe tener 18 dígitos)',
      digitoCalculado: -1,
      digitoRecibido: -1,
      motivo: 'La longitud debe ser exactamente de 18 dígitos numéricos.',
    };
  }

  const codigo = clean.slice(0, 3);
  const bancoNombre = BANXICO_BANCOS[codigo] || `Institución Código ${codigo} (SPEI)`;
  const clabe17 = clean.slice(0, 17);
  const digitoRecibido = parseInt(clean.charAt(17), 10);
  const digitoCalculado = calcularDigitoVerificadorClabe(clabe17);

  if (digitoCalculado !== digitoRecibido) {
    return {
      valida: false,
      bancoCodigo: codigo,
      bancoNombre,
      digitoCalculado,
      digitoRecibido,
      motivo: `Dígito verificador erróneo: recibido ${digitoRecibido}, calculado por algoritmo Banxico ${digitoCalculado}.`,
    };
  }

  return {
    valida: true,
    bancoCodigo: codigo,
    bancoNombre,
    digitoCalculado,
    digitoRecibido,
  };
}

/**
 * Validador de formato DIMO (Dinero Móvil - Banxico)
 * 10 dígitos numéricos celulares
 */
export function validarDimo(numero: string): { valida: boolean; motivo?: string } {
  const clean = numero.trim().replace(/\D/g, '');
  if (clean.length !== 10) {
    return {
      valida: false,
      motivo: 'El número DIMO debe ser un número celular mexicano de exactamente 10 dígitos.',
    };
  }
  return { valida: true };
}

/**
 * Regla inquebrantable #1: NUNCA usar datos reales en Modo Sandbox.
 * Todo CURP, CLABE, nombre y monto deben ser sintéticos con formato TEST_xxx.
 */
export function detectarDatoPotencialmenteReal(item: {
  beneficiario: string;
  rfcCurp: string;
  clabeODimo: string;
}): { esReal: boolean; advertencia?: string } {
  const b = item.beneficiario.toUpperCase();
  const rfc = item.rfcCurp.toUpperCase();

  const tienePrefijoTest =
    b.includes('TEST') ||
    b.includes('SIMULAD') ||
    b.includes('FICTICI') ||
    rfc.includes('TEST') ||
    rfc.includes('XAXX010101000'); // RFC genérico

  // Si no contiene TEST y tiene apariencia de RFC real de persona moral o física (12 o 13 letras con fecha y homoclave)
  const regexRfcFisica = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
  const regexRfcMoral = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;
  const regexCurp = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;

  if (!tienePrefijoTest) {
    if (regexRfcFisica.test(rfc) || regexRfcMoral.test(rfc) || regexCurp.test(rfc)) {
      return {
        esReal: true,
        advertencia: `Dato sensible detectado: El RFC/CURP '${item.rfcCurp}' coincide con estructura real de SAT sin prefijo 'TEST_'. En Sandbox se exige 'TEST_RFC_XXX' según CNBV Art. 115.`,
      };
    }
    // Si el nombre no contiene TEST
    if (b.length > 5 && !b.includes('TEST') && !b.startsWith('DEMO')) {
      return {
        esReal: true,
        advertencia: `Nombre '${item.beneficiario}' no contiene prefijo sintético obligatorio 'TEST_'. Modifíquelo a TEST_001_${item.beneficiario.replace(/\s+/g, '_')}.`,
      };
    }
  }

  return { esReal: false };
}

/**
 * Generador de Hash criptográfico SHA-256 para bitácora y cadena de custodia
 */
export async function generarSha256(texto: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback simple si Web Crypto no está listo
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      hash = (hash << 5) - hash + texto.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, 'a');
  }
}

/**
 * Base de datos sintética de listas para Screening PLD
 */
export const LISTAS_SINTETICAS_PLD = [
  {
    id: 'LST-OFAC-01',
    tipo: 'OFAC_SDN' as const,
    nombre: 'TEST_OFAC_CARTEL_SINTETICO_SA',
    rfc: 'TEST_OFA_880101_XX1',
    motivo: 'Designación OFAC SDN Programa Kingpin Act / Narcóticos Sintéticos',
  },
  {
    id: 'LST-SAT-02',
    tipo: 'SAT_69B' as const,
    nombre: 'TEST_FACTURERA_FANTASMA_EDOS_SA',
    rfc: 'TEST_FAC_190412_69B',
    motivo: 'Listado Definitivo SAT Art. 69-B CFF (Empresa que Factura Operaciones Simuladas - EFOS)',
  },
  {
    id: 'LST-UIF-03',
    tipo: 'UIF_BLOQUEADAS' as const,
    nombre: 'TEST_PERSONA_BLOQUEADA_UIF_001',
    rfc: 'TEST_UIF_770921_LPB',
    motivo: 'Acuerdo de Inclusión en la Lista de Personas Bloqueadas (LPB) de la UIF Secretaría de Hacienda',
  },
  {
    id: 'LST-PEP-04',
    tipo: 'PEP_MUNDIAL' as const,
    nombre: 'TEST_PEP_SENADOR_SINTETICO_001',
    rfc: 'TEST_PEP_650315_GOB',
    motivo: 'Persona Políticamente Expuesta (PEP Nacional) - Exige Diligencia Reforzada según Art. 115',
  },
];

/**
 * Motor de screening sintético
 */
export function ejecutarScreeningPld(item: DispersalItem): DispersalItem['screeningPld'] {
  const normBenef = item.beneficiario.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normRfc = item.rfcCurp.toUpperCase().replace(/[^A-Z0-9]/g, '');

  let coincidencia: (typeof LISTAS_SINTETICAS_PLD)[0] | undefined;
  let porcentajeHomonimia = 0;

  for (const lista of LISTAS_SINTETICAS_PLD) {
    const listNorm = lista.nombre.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const listRfc = lista.rfc.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (normRfc === listRfc) {
      coincidencia = lista;
      porcentajeHomonimia = 100;
      break;
    }

    if (normBenef.includes('OFAC') || listNorm.includes('OFAC')) {
      if (normBenef.includes('OFAC') && listNorm.includes('OFAC')) {
        coincidencia = lista;
        porcentajeHomonimia = 98;
        break;
      }
    }

    if (normBenef.includes('FACTURERA') || normBenef.includes('69B') || normBenef.includes('FANTASMA')) {
      if (lista.tipo === 'SAT_69B') {
        coincidencia = lista;
        porcentajeHomonimia = 95;
        break;
      }
    }

    if (normBenef.includes('BLOQUEADA') || normBenef.includes('UIF')) {
      if (lista.tipo === 'UIF_BLOQUEADAS') {
        coincidencia = lista;
        porcentajeHomonimia = 99;
        break;
      }
    }

    if (normBenef.includes('PEP') || normBenef.includes('SENADOR') || normBenef.includes('GOBERNADOR')) {
      if (lista.tipo === 'PEP_MUNDIAL') {
        coincidencia = lista;
        porcentajeHomonimia = 92;
        break;
      }
    }
  }

  // Perfil transaccional
  const perfilDeclarado = item.screeningPld?.montoPerfilDeclarado || 75000;
  let perfilTransaccional: 'HABITUAL' | 'MODERADO' | 'INUSUAL' = 'HABITUAL';
  if (item.monto > perfilDeclarado * 2) {
    perfilTransaccional = 'INUSUAL';
  } else if (item.monto > perfilDeclarado) {
    perfilTransaccional = 'MODERADO';
  }

  // KYC Expediente
  const kycVigente = item.screeningPld?.kycVigente !== false;

  if (coincidencia) {
    return {
      status: 'COINCIDENCIA',
      listaCoincidencia: coincidencia.tipo,
      porcentajeHomonimia,
      detalleAlerta: `${coincidencia.motivo} (Coincidencia con registro sintético ${coincidencia.id})`,
      perfilTransaccional,
      montoPerfilDeclarado: perfilDeclarado,
      kycVigente,
      expedienteDoc: item.screeningPld.expedienteDoc,
      accionPld: coincidencia.tipo === 'UIF_BLOQUEADAS' ? 'BLOQUEAR' : 'REPORTAR_ROI',
      notaAclaratoria: 'Se requiere dictamen formal del Oficial de Cumplimiento antes de liberar el lote.',
    };
  }

  return {
    status: 'SIN_COINCIDENCIA',
    porcentajeHomonimia: 0,
    perfilTransaccional,
    montoPerfilDeclarado: perfilDeclarado,
    kycVigente,
    expedienteDoc: item.screeningPld.expedienteDoc,
    accionPld: perfilTransaccional === 'INUSUAL' ? 'SOLICITAR_ACLARACION' : 'LIBERAR',
  };
}

/**
 * Plantillas predeterminadas de Lotes Sintéticos para entrenamiento y auditoría
 */
export function generarLoteEjemplo(
  tipoEjemplo: 'NOMINA_LIMPIA' | 'ALERTA_DIMO' | 'ALERTA_PLD_LISTAS' | 'EXCESO_MTU',
  udiValor: number = VALOR_UDI_DEFAULT,
  mtu: number = MTU_CORPORATIVO_DEFAULT
): DispersalBatch {
  const folio = `LOTE-TEST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const topeDimoMxn = TOPE_DIMO_UDIS * udiValor;

  let items: DispersalItem[] = [];

  if (tipoEjemplo === 'NOMINA_LIMPIA') {
    items = [
      {
        id: 'ITEM-TEST-001',
        tipo: 'SPEI',
        clabeODimo: '012180001234567897', // BBVA (Dígito verificador 7 calculado)
        bancoDestino: 'BBVA MÉXICO',
        codigoBanco: '012',
        beneficiario: 'TEST_001_JUAN_PEREZ_LOPEZ',
        rfcCurp: 'TEST_PELJ8501019A1',
        monto: 24500.0,
        referencia: '1234567',
        concepto: 'PAGO NOMINA TEST QUINCENA 20',
        cuentaOrigen: '646180112233445561',
        institucionOrigen: '646 - STP BANXICO',
        validaciones: {
          clabeValida: true,
          digitoVerificadorCalculado: 7,
          dimoValido: true,
          excede1500Udis: false,
          excedeMtu: false,
          esDatoPotencialmenteReal: false,
          errores: [],
          advertencias: [],
        },
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
      },
      {
        id: 'ITEM-TEST-002',
        tipo: 'DIMO',
        clabeODimo: '5512345678', // 10 dígitos celular
        bancoDestino: 'DIMO BANXICO (DINERO MÓVIL)',
        codigoBanco: 'DIMO',
        beneficiario: 'TEST_002_MARIA_GARCIA_RUIZ',
        rfcCurp: 'TEST_GARM9002158Z3',
        monto: 8500.0, // menor a 1500 UDIS ($12,678 MXN)
        referencia: '7654321',
        concepto: 'VIATICOS OPERATIVOS DIMO TEST',
        cuentaOrigen: '646180112233445561',
        institucionOrigen: '646 - STP BANXICO',
        validaciones: {
          clabeValida: true,
          digitoVerificadorCalculado: 0,
          dimoValido: true,
          excede1500Udis: false,
          excedeMtu: false,
          esDatoPotencialmenteReal: false,
          errores: [],
          advertencias: [],
        },
        screeningPld: {
          status: 'SIN_COINCIDENCIA',
          perfilTransaccional: 'HABITUAL',
          montoPerfilDeclarado: 35000,
          kycVigente: true,
          expedienteDoc: {
            ineVigente: true,
            comprobanteDomicilioMenor90d: true,
            cifSat: true,
            beneficiarioFinalUbo: true,
          },
          accionPld: 'LIBERAR',
        },
      },
      {
        id: 'ITEM-TEST-003',
        tipo: 'SPEI',
        clabeODimo: '002180012345678901', // Banamex (Dígito verificador 1)
        bancoDestino: 'BANAMEX (Banco Nacional de México)',
        codigoBanco: '002',
        beneficiario: 'TEST_003_PROVEEDOR_LOGISTICA_SA',
        rfcCurp: 'TEST_PLO120520AA2',
        monto: 84200.0,
        referencia: '9988112',
        concepto: 'FACTURA TEST SERVICIOS FLETEROS',
        cuentaOrigen: '646180112233445561',
        institucionOrigen: '646 - STP BANXICO',
        validaciones: {
          clabeValida: true,
          digitoVerificadorCalculado: 1,
          dimoValido: true,
          excede1500Udis: false,
          excedeMtu: false,
          esDatoPotencialmenteReal: false,
          errores: [],
          advertencias: [],
        },
        screeningPld: {
          status: 'SIN_COINCIDENCIA',
          perfilTransaccional: 'HABITUAL',
          montoPerfilDeclarado: 150000,
          kycVigente: true,
          expedienteDoc: {
            ineVigente: true,
            comprobanteDomicilioMenor90d: true,
            cifSat: true,
            beneficiarioFinalUbo: true,
          },
          accionPld: 'LIBERAR',
        },
      },
    ];
  } else if (tipoEjemplo === 'ALERTA_DIMO') {
    items = [
      {
        id: 'ITEM-TEST-004',
        tipo: 'DIMO',
        clabeODimo: '5598765432',
        bancoDestino: 'DIMO BANXICO (DINERO MÓVIL)',
        codigoBanco: 'DIMO',
        beneficiario: 'TEST_004_CARLOS_RODRIGUEZ_TEST',
        rfcCurp: 'TEST_RODC880402BB1',
        monto: 18500.0, // EXCEDE 1500 UDIS ($12,678)
        referencia: '3344556',
        concepto: 'PAGO EXCEDE TOPE DIMO 1500 UDIS',
        cuentaOrigen: '646180112233445561',
        institucionOrigen: '646 - STP BANXICO',
        validaciones: {
          clabeValida: true,
          digitoVerificadorCalculado: 0,
          dimoValido: true,
          excede1500Udis: true,
          excedeMtu: false,
          esDatoPotencialmenteReal: false,
          errores: [
            `Infracción Circular Banxico 14/2017: Dispersión DIMO por $18,500.00 MXN supera el límite regulatorio de 1,500 UDIS ($${topeDimoMxn.toFixed(2)} MXN). Debe canalizarse por SPEI ordinario.`,
          ],
          advertencias: ['Bloqueo preventivo en Dispersor SPEI.'],
        },
        screeningPld: {
          status: 'SIN_COINCIDENCIA',
          perfilTransaccional: 'HABITUAL',
          montoPerfilDeclarado: 40000,
          kycVigente: true,
          expedienteDoc: {
            ineVigente: true,
            comprobanteDomicilioMenor90d: true,
            cifSat: true,
            beneficiarioFinalUbo: true,
          },
          accionPld: 'SOLICITAR_ACLARACION',
        },
      },
      {
        id: 'ITEM-TEST-005',
        tipo: 'SPEI',
        clabeODimo: '072180000112233448', // Banorte
        bancoDestino: 'BANORTE',
        codigoBanco: '072',
        beneficiario: 'TEST_005_CONSULTORIA_IT_TEST',
        rfcCurp: 'TEST_CIT150918CC3',
        monto: 45000.0,
        referencia: '1122334',
        concepto: 'SOPORTE SERVIDORES STP TEST',
        cuentaOrigen: '646180112233445561',
        institucionOrigen: '646 - STP BANXICO',
        validaciones: {
          clabeValida: true,
          digitoVerificadorCalculado: 8,
          dimoValido: true,
          excede1500Udis: false,
          excedeMtu: false,
          esDatoPotencialmenteReal: false,
          errores: [],
          advertencias: [],
        },
        screeningPld: {
          status: 'SIN_COINCIDENCIA',
          perfilTransaccional: 'HABITUAL',
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
      },
    ];
  } else if (tipoEjemplo === 'ALERTA_PLD_LISTAS') {
    items = [
      {
        id: 'ITEM-TEST-006',
        tipo: 'SPEI',
        clabeODimo: '014180605001122330', // Santander
        bancoDestino: 'SANTANDER MÉXICO',
        codigoBanco: '014',
        beneficiario: 'TEST_OFAC_CARTEL_SINTETICO_SA',
        rfcCurp: 'TEST_OFA_880101_XX1',
        monto: 135000.0,
        referencia: '8877665',
        concepto: 'TRANSFERENCIA A REVISAR OFAC TEST',
        cuentaOrigen: '646180112233445561',
        institucionOrigen: '646 - STP BANXICO',
        validaciones: {
          clabeValida: true,
          digitoVerificadorCalculado: 0,
          dimoValido: true,
          excede1500Udis: false,
          excedeMtu: false,
          esDatoPotencialmenteReal: false,
          errores: [],
          advertencias: ['Alerta PLD: Beneficiario en lista restringida simulada.'],
        },
        screeningPld: {
          status: 'COINCIDENCIA',
          listaCoincidencia: 'OFAC_SDN',
          porcentajeHomonimia: 98,
          detalleAlerta: 'Designación OFAC SDN Programa Kingpin Act / Narcóticos Sintéticos',
          perfilTransaccional: 'INUSUAL',
          montoPerfilDeclarado: 40000,
          kycVigente: false,
          expedienteDoc: {
            ineVigente: true,
            comprobanteDomicilioMenor90d: false,
            cifSat: true,
            beneficiarioFinalUbo: false,
          },
          accionPld: 'BLOQUEAR',
          notaAclaratoria: 'Exige emisión inmediata de Reporte de 24 Horas SITI PLD y congelamiento preventivo.',
        },
      },
      {
        id: 'ITEM-TEST-007',
        tipo: 'SPEI',
        clabeODimo: '021180554433221105', // HSBC
        bancoDestino: 'HSBC MÉXICO',
        codigoBanco: '021',
        beneficiario: 'TEST_FACTURERA_FANTASMA_EDOS_SA',
        rfcCurp: 'TEST_FAC_190412_69B',
        monto: 98000.0,
        referencia: '4455667',
        concepto: 'PAGO HONORARIOS COMERCIALES TEST',
        cuentaOrigen: '646180112233445561',
        institucionOrigen: '646 - STP BANXICO',
        validaciones: {
          clabeValida: true,
          digitoVerificadorCalculado: 5,
          dimoValido: true,
          excede1500Udis: false,
          excedeMtu: false,
          esDatoPotencialmenteReal: false,
          errores: [],
          advertencias: ['Alerta SAT 69-B: Empresa catalogada como presunta simuladora de operaciones.'],
        },
        screeningPld: {
          status: 'COINCIDENCIA',
          listaCoincidencia: 'SAT_69B',
          porcentajeHomonimia: 95,
          detalleAlerta: 'Listado Definitivo SAT Art. 69-B CFF (EFOS - Operaciones Simuladas)',
          perfilTransaccional: 'INUSUAL',
          montoPerfilDeclarado: 30000,
          kycVigente: true,
          expedienteDoc: {
            ineVigente: true,
            comprobanteDomicilioMenor90d: true,
            cifSat: true,
            beneficiarioFinalUbo: true,
          },
          accionPld: 'REPORTAR_ROI',
          notaAclaratoria: 'Generar Reporte de Operación Inusual (ROI) ante CNBV.',
        },
      },
    ];
  } else {
    // EXCESO_MTU
    items = [
      {
        id: 'ITEM-TEST-008',
        tipo: 'SPEI',
        clabeODimo: '012180001122334455', // BBVA
        bancoDestino: 'BBVA MÉXICO',
        codigoBanco: '012',
        beneficiario: 'TEST_008_COMPRA_MAQUINARIA_TEST_SA',
        rfcCurp: 'TEST_CMM110203XX4',
        monto: 650000.0, // EXCEDE MTU ($250,000)
        referencia: '9900112',
        concepto: 'ADQUISICION LINEA PRODUCCION TEST',
        cuentaOrigen: '646180112233445561',
        institucionOrigen: '646 - STP BANXICO',
        validaciones: {
          clabeValida: true,
          digitoVerificadorCalculado: 5,
          dimoValido: true,
          excede1500Udis: false,
          excedeMtu: true,
          esDatoPotencialmenteReal: false,
          errores: [
            `Excede MTU Corporativo: $650,000.00 MXN supera el Monto Transaccional Unitario configurado ($${mtu.toLocaleString(
              'es-MX'
            )}.00 MXN). Requiere doble mancomunidad y autorización de Oficial de Cumplimiento.`,
          ],
          advertencias: ['Tratamiento de operación de alto valor según manual PLD/FT.'],
        },
        screeningPld: {
          status: 'SIN_COINCIDENCIA',
          perfilTransaccional: 'INUSUAL',
          montoPerfilDeclarado: 200000,
          kycVigente: true,
          expedienteDoc: {
            ineVigente: true,
            comprobanteDomicilioMenor90d: true,
            cifSat: true,
            beneficiarioFinalUbo: true,
          },
          accionPld: 'SOLICITAR_ACLARACION',
          notaAclaratoria: 'Presentar Contrato de Compraventa y Factura XML CFDI 4.0 debidamente validada en SAT.',
        },
      },
    ];
  }

  const totalMonto = items.reduce((acc, curr) => acc + curr.monto, 0);

  return {
    folio,
    createdAt: new Date().toISOString(),
    createdBy: {
      id: PERSONAS_PREDETERMINADAS.ORIGINADOR.id,
      nombre: PERSONAS_PREDETERMINADAS.ORIGINADOR.nombre,
      cargo: PERSONAS_PREDETERMINADAS.ORIGINADOR.cargo,
      ip: PERSONAS_PREDETERMINADAS.ORIGINADOR.ipSimulada,
      token: `TOK-SESS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    },
    ambienteLote: 'SANDBOX_SYNTHETIC',
    origenRecursos: {
      fuente: 'Cobranza de Clientes Concentradora STP Banxico',
      uuidFacturaSat: `TEST-CFDI-${Math.random().toString(36).substring(2, 8).toUpperCase()}-4B9A-901F-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}`,
      centroCostos: 'CC-TESORERIA-804',
      cuentaConcentradora: '646180112233445561',
      justificacionEconomica: 'Dispersión programada de nómina y pagos a proveedores autorizados según presupuesto operativo.',
    },
    mtuAplicado: mtu,
    udiValorAplicado: udiValor,
    topeDimoUdis: TOPE_DIMO_UDIS,
    topeDimoMxn,
    items,
    totalMonto,
    totalItems: items.length,
    hashSha256Lote: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    etapa: 'ORIGINADO',
  };
}

// Configuración predeterminada de Producción Mainnet STP Banxico
export const CONFIG_STP_PRODUCCION_DEFAULT = {
  empresaStp: 'CORP_LOGISTICA_Y_PAGOS_MEXICO_SA',
  cuentaConcentradora: '646180123456789012',
  saldoDisponible: 1850000.0,
  saldoRetenido: 25000.0,
  endpointStp: 'https://enlace.stp.com.mx/speiws/rest/ordenPago/registra',
  ambiente: 'PRODUCCION' as const,
  certificadoPem: '-----BEGIN CERTIFICATE-----\nMIIDxDCCAqygAwIBAgIUMDAwMDAxMDAwMDA1MDg0OTIwMTkwDQYJKoZIhvcNAQEL\nBQAwggEvMTgwNgYDVQQDDC9BQyBkZWwgU2VydmljaW8gZGUgQWRtaW5pc3RyYWNp\n...STP-BANXICO-PRODUCCION-X509-CERT-VIGENTE...\n-----END CERTIFICATE-----',
  numeroCertificado: '00000100000508492019',
  llavePrivadaCargada: true,
  webhookCepUrl: 'https://api.empresa.com.mx/spei/webhook/recepcion-cep',
  ultimoPingStp: '2026-10-29T21:50:00Z',
  estadoConexion: 'CONECTADO_ACTIVO' as const,
};

/**
 * Validador oficial de RFC mexicano de SAT (Persona Física o Moral)
 */
export function validarRfcMexicano(rfc: string): { valido: boolean; tipo?: 'FISICA' | 'MORAL'; motivo?: string } {
  const clean = rfc.trim().toUpperCase();
  const regexMoral = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;
  const regexFisica = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;

  if (regexMoral.test(clean)) {
    return { valido: true, tipo: 'MORAL' };
  }
  if (regexFisica.test(clean)) {
    return { valido: true, tipo: 'FISICA' };
  }

  return {
    valido: false,
    motivo: 'Estructura de RFC inválida. Debe tener 12 (Moral) o 13 (Física) caracteres con homoclave válida.',
  };
}

/**
 * Generador de Trama Original de Orden de Pago SPEI para firma con certificado X.509
 */
export function generarTramaOriginalStp(
  item: DispersalItem,
  empresa: string,
  cuentaOrigen: string,
  claveRastreo: string
): string {
  return `||${empresa}|${cuentaOrigen}|${item.codigoBanco}|${item.clabeODimo}|${item.monto.toFixed(2)}|${item.concepto}|${claveRastreo}||`;
}

/**
 * Generador de Lote de Producción Mainnet (Datos Reales de Proveedores y Nómina)
 */
export function generarLoteMainnetReal(
  udiValor: number = VALOR_UDI_DEFAULT,
  mtu: number = MTU_CORPORATIVO_DEFAULT
): DispersalBatch {
  const folio = `LOTE-MAINNET-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const topeDimoMxn = TOPE_DIMO_UDIS * udiValor;

  const items: DispersalItem[] = [
    {
      id: 'ITEM-PROD-001',
      tipo: 'SPEI',
      clabeODimo: '012180001234567897', // BBVA (Dígito 7 verificado)
      bancoDestino: 'BBVA MÉXICO',
      codigoBanco: '012',
      beneficiario: 'LOGÍSTICA INTEGRAL Y FLETES DEL PACÍFICO S.A. DE C.V.',
      rfcCurp: 'LIF1408229A3',
      monto: 128450.0,
      referencia: '102901',
      concepto: 'PAGO FACTURA FLETE CONTRATO CFDI',
      cuentaOrigen: '646180123456789012',
      institucionOrigen: '646 - STP BANXICO (PRODUCCIÓN)',
      validaciones: {
        clabeValida: true,
        digitoVerificadorCalculado: 7,
        dimoValido: true,
        excede1500Udis: false,
        excedeMtu: false,
        esDatoPotencialmenteReal: true,
        rfcValidoSat: true,
        errores: [],
        advertencias: [],
      },
      screeningPld: {
        status: 'SIN_COINCIDENCIA',
        perfilTransaccional: 'HABITUAL',
        montoPerfilDeclarado: 350000,
        kycVigente: true,
        expedienteDoc: {
          ineVigente: true,
          comprobanteDomicilioMenor90d: true,
          cifSat: true,
          beneficiarioFinalUbo: true,
        },
        accionPld: 'LIBERAR',
      },
    },
    {
      id: 'ITEM-PROD-002',
      tipo: 'SPEI',
      clabeODimo: '072180000112233448', // Banorte (Dígito 8 verificado)
      bancoDestino: 'BANORTE',
      codigoBanco: '072',
      beneficiario: 'SERVICIOS EN LA NUBE Y CIBERSEGURIDAD MÉXICO S. DE R.L. DE C.V.',
      rfcCurp: 'SCN180315AA8',
      monto: 47820.0,
      referencia: '102902',
      concepto: 'SUSCRIPCION HOSTING SERVIDORES OCT',
      cuentaOrigen: '646180123456789012',
      institucionOrigen: '646 - STP BANXICO (PRODUCCIÓN)',
      validaciones: {
        clabeValida: true,
        digitoVerificadorCalculado: 8,
        dimoValido: true,
        excede1500Udis: false,
        excedeMtu: false,
        esDatoPotencialmenteReal: true,
        rfcValidoSat: true,
        errores: [],
        advertencias: [],
      },
      screeningPld: {
        status: 'SIN_COINCIDENCIA',
        perfilTransaccional: 'HABITUAL',
        montoPerfilDeclarado: 120000,
        kycVigente: true,
        expedienteDoc: {
          ineVigente: true,
          comprobanteDomicilioMenor90d: true,
          cifSat: true,
          beneficiarioFinalUbo: true,
        },
        accionPld: 'LIBERAR',
      },
    },
    {
      id: 'ITEM-PROD-003',
      tipo: 'DIMO',
      clabeODimo: '5541982345',
      bancoDestino: 'DIMO BANXICO (DINERO MÓVIL)',
      codigoBanco: 'DIMO',
      beneficiario: 'MARTHA ELENA SÁNCHEZ HERNÁNDEZ',
      rfcCurp: 'SAHM8507148Z1',
      monto: 9200.0, // menor a 1500 UDIS ($12,678 MXN)
      referencia: '102903',
      concepto: 'DISPERSION DIMO REEMBOLSO CAJA CHICA',
      cuentaOrigen: '646180123456789012',
      institucionOrigen: '646 - STP BANXICO (PRODUCCIÓN)',
      validaciones: {
        clabeValida: true,
        digitoVerificadorCalculado: 0,
        dimoValido: true,
        excede1500Udis: false,
        excedeMtu: false,
        esDatoPotencialmenteReal: true,
        rfcValidoSat: true,
        errores: [],
        advertencias: [],
      },
      screeningPld: {
        status: 'SIN_COINCIDENCIA',
        perfilTransaccional: 'HABITUAL',
        montoPerfilDeclarado: 45000,
        kycVigente: true,
        expedienteDoc: {
          ineVigente: true,
          comprobanteDomicilioMenor90d: true,
          cifSat: true,
          beneficiarioFinalUbo: true,
        },
        accionPld: 'LIBERAR',
      },
    },
  ];

  const totalMonto = items.reduce((acc, curr) => acc + curr.monto, 0);

  return {
    folio,
    ambienteLote: 'MAINNET_REAL',
    createdAt: new Date().toISOString(),
    createdBy: {
      id: PERSONAS_PREDETERMINADAS.ORIGINADOR.id,
      nombre: PERSONAS_PREDETERMINADAS.ORIGINADOR.nombre,
      cargo: PERSONAS_PREDETERMINADAS.ORIGINADOR.cargo,
      ip: '187.189.44.12 (Enlace Dedicado VPN STP)',
      token: `TOK-PROD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    },
    origenRecursos: {
      fuente: 'Cuenta Concentradora Operativa STP Banxico Clave 646',
      uuidFacturaSat: '938b814a-8742-4f39-9d7a-d083bc7281e5',
      centroCostos: 'CC-OPERACIONES-MAINNET-01',
      cuentaConcentradora: '646180123456789012',
      justificacionEconomica: 'Dispersión real de pagos a proveedores de logística y servicios tecnológicos con CFDI 4.0 verificado ante SAT.',
    },
    mtuAplicado: mtu,
    udiValorAplicado: udiValor,
    topeDimoUdis: TOPE_DIMO_UDIS,
    topeDimoMxn,
    items,
    totalMonto,
    totalItems: items.length,
    hashSha256Lote: '9a7bc418a09f38148b812efd8801991ab837f4810294b7c615a990019284ba01',
    etapa: 'ORIGINADO',
  };
}
