import React, { useState } from 'react';
import { AppRole, EnvironmentMode, DispersalBatch, StpProductionConfig } from './types/spei';
import {
  PERSONAS_PREDETERMINADAS,
  generarLoteEjemplo,
  generarLoteMainnetReal,
  CONFIG_STP_PRODUCCION_DEFAULT,
  VALOR_UDI_DEFAULT,
  MTU_CORPORATIVO_DEFAULT,
} from './utils/speiValidation';
import { Navbar } from './components/Navbar';
import { RoleBanner } from './components/RoleBanner';
import { OriginatorView } from './components/OriginatorView';
import { ComplianceView } from './components/ComplianceView';
import { AuditorView } from './components/AuditorView';
import { ClabeUdiCalculatorModal } from './components/ClabeUdiCalculatorModal';
import { MainnetWarningModal } from './components/MainnetWarningModal';
import { SitiLogModal } from './components/SitiLogModal';
import { StpMainnetConsole } from './components/StpMainnetConsole';

export default function App() {
  const [currentRole, setCurrentRole] = useState<AppRole>('ORIGINADOR');
  const [environmentMode, setEnvironmentMode] = useState<EnvironmentMode>('MAINNET_REAL');

  // Configuración de Producción STP Mainnet
  const [stpConfig, setStpConfig] = useState<StpProductionConfig>(CONFIG_STP_PRODUCCION_DEFAULT);

  // Lote de dispersión activo (Inicializado por defecto en Modo Mainnet Real con opción a Sandbox)
  const [currentBatch, setCurrentBatch] = useState<DispersalBatch>(() =>
    generarLoteMainnetReal(VALOR_UDI_DEFAULT, MTU_CORPORATIVO_DEFAULT)
  );

  // Modals state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [isMainnetModalOpen, setIsMainnetModalOpen] = useState<boolean>(false);
  const [isSitiLogOpen, setIsSitiLogOpen] = useState<boolean>(false);
  const [isStpConsoleOpen, setIsStpConsoleOpen] = useState<boolean>(false);

  const activePersona = PERSONAS_PREDETERMINADAS[currentRole];

  // Siguiente rol con segregación
  const handleNextRole = () => {
    if (currentRole === 'ORIGINADOR') {
      setCurrentRole('CUMPLIMIENTO');
    } else if (currentRole === 'CUMPLIMIENTO') {
      setCurrentRole('AUDITOR');
    } else {
      setCurrentRole('ORIGINADOR');
    }
  };

  const handleSwitchEnvironment = (mode: EnvironmentMode) => {
    setEnvironmentMode(mode);
    if (mode === 'MAINNET_REAL') {
      const nuevo = generarLoteMainnetReal(currentBatch.udiValorAplicado, currentBatch.mtuAplicado);
      setCurrentBatch(nuevo);
    } else {
      const nuevo = generarLoteEjemplo('NOMINA_LIMPIA', currentBatch.udiValorAplicado, currentBatch.mtuAplicado);
      setCurrentBatch(nuevo);
    }
    setCurrentRole('ORIGINADOR');
  };

  const handleNewBatch = () => {
    if (environmentMode === 'MAINNET_REAL') {
      const nuevo = generarLoteMainnetReal(currentBatch.udiValorAplicado, currentBatch.mtuAplicado);
      setCurrentBatch(nuevo);
    } else {
      const nuevo = generarLoteEjemplo('NOMINA_LIMPIA', currentBatch.udiValorAplicado, currentBatch.mtuAplicado);
      setCurrentBatch(nuevo);
    }
    setCurrentRole('ORIGINADOR');
  };

  const handleApplyUdiValor = (valor: number) => {
    setCurrentBatch((prev) => ({
      ...prev,
      udiValorAplicado: valor,
      topeDimoMxn: prev.topeDimoUdis * valor,
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-white">
      {/* Top Bar following 3-Zone Contract */}
      <Navbar
        currentRole={currentRole}
        onSelectRole={setCurrentRole}
        environmentMode={environmentMode}
        onToggleEnvironment={() => setIsMainnetModalOpen(true)}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        onOpenAuditLog={() => setIsSitiLogOpen(true)}
        onNewBatchModal={handleNewBatch}
        onOpenStpConsole={() => setIsStpConsoleOpen(true)}
      />

      {/* Segregation of Duties Banner & Role Bar */}
      <RoleBanner
        currentRole={currentRole}
        persona={activePersona}
        onNextRole={handleNextRole}
        environmentMode={environmentMode}
        onSelectRole={setCurrentRole}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentRole === 'ORIGINADOR' && (
          <OriginatorView
            currentBatch={currentBatch}
            onUpdateBatch={setCurrentBatch}
            onAdvanceToCompliance={() => setCurrentRole('CUMPLIMIENTO')}
            persona={activePersona}
            onOpenCalculator={() => setIsCalculatorOpen(true)}
            environmentMode={environmentMode}
            onToggleEnvironment={() => setIsMainnetModalOpen(true)}
            stpConfig={stpConfig}
            onOpenStpConsole={() => setIsStpConsoleOpen(true)}
          />
        )}

        {currentRole === 'CUMPLIMIENTO' && (
          <ComplianceView
            currentBatch={currentBatch}
            onUpdateBatch={setCurrentBatch}
            onAdvanceToAuditor={() => setCurrentRole('AUDITOR')}
            persona={activePersona}
          />
        )}

        {currentRole === 'AUDITOR' && (
          <AuditorView
            currentBatch={currentBatch}
            onUpdateBatch={setCurrentBatch}
            persona={activePersona}
            onResetOrNew={handleNewBatch}
            environmentMode={environmentMode}
            stpConfig={stpConfig}
            onUpdateStpConfig={setStpConfig}
            onOpenStpConsole={() => setIsStpConsoleOpen(true)}
          />
        )}
      </main>

      {/* Footer conforming to Anti-Slop Discipline */}
      <footer className="border-t border-slate-800 bg-slate-900 px-6 py-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>Dispersor SPEI / DIMO</span>
            <span>·</span>
            <span>CNBV Disposiciones Art. 115</span>
            <span>·</span>
            <span>Conexión STP Banxico Directa</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
            <span>
              Entorno Actual:{' '}
              <strong className={environmentMode === 'MAINNET_REAL' ? 'text-emerald-400' : 'text-amber-400'}>
                {environmentMode === 'MAINNET_REAL' ? 'PRODUCCIÓN MAINNET' : 'SANDBOX SINTÉTICO (ENTRENAMIENTO)'}
              </strong>
            </span>
            <span>·</span>
            <span>Segregación Activa: 3 Roles CNBV</span>
          </div>
        </div>
      </footer>

      {/* Interactive Tool Modals */}
      <ClabeUdiCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        onApplyUdiValor={handleApplyUdiValor}
      />

      <MainnetWarningModal
        isOpen={isMainnetModalOpen}
        onClose={() => setIsMainnetModalOpen(false)}
        onSwitchMode={handleSwitchEnvironment}
        currentMode={environmentMode}
      />

      <SitiLogModal
        isOpen={isSitiLogOpen}
        onClose={() => setIsSitiLogOpen(false)}
        batch={currentBatch}
      />

      {/* STP Mainnet Connection Console Modal */}
      {isStpConsoleOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-3xl w-full">
            <StpMainnetConsole
              config={stpConfig}
              onUpdateConfig={setStpConfig}
              onClose={() => setIsStpConsoleOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
