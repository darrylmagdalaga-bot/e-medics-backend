import React, { useState, useEffect } from 'react';
import { ClinicalLayout } from './components/Layout/ClinicalLayout';
import { ClinicalDashboard } from './components/Dashboard/ClinicalDashboard';
import { PatientRegistry } from './components/Registry/PatientRegistry';
import { NewEncounterView } from './components/Encounter/NewEncounterView';
import { EncounterHistoryView } from './components/Encounter/EncounterHistoryView';
import { PatientProfileView } from './components/Profile/PatientProfileView';
import { EncounterDetailsModal } from './components/Encounter/EncounterDetailsModal';
import { AmendEncounterModal } from './components/Encounter/AmendEncounterModal';
import { ClinicalEncounter } from './types';

export function ClinicalModule({ initialTab = 'dashboard' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null);

  // Modals
  const [activeEncounterId, setActiveEncounterId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [amendingEncounter, setAmendingEncounter] = useState<ClinicalEncounter | null>(null);
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);

  // Workflow Handlers
  const handleSelectPatient = (patientId: number, patientName?: string) => {
    setSelectedPatientId(patientId);
    if (patientName) setSelectedPatientName(patientName);
    setActiveTab('profile');
  };

  const handleStartConsultation = (patientId?: number) => {
    if (patientId) {
      setSelectedPatientId(patientId);
    }
    setActiveTab('new-encounter');
  };

  const handleEncounterCreated = (encounterId: number) => {
    setActiveEncounterId(encounterId);
    setIsDetailsModalOpen(true);
    setActiveTab('encounters');
  };

  const handleOpenEncounterDetails = (encounterId: number) => {
    setActiveEncounterId(encounterId);
    setIsDetailsModalOpen(true);
  };

  const handleOpenAmendModal = (encounter: ClinicalEncounter) => {
    setAmendingEncounter(encounter);
    setIsAmendModalOpen(true);
  };

  const handleAmendSuccess = () => {
    setIsAmendModalOpen(false);
    setAmendingEncounter(null);
    // Re-open details modal with updated information
    if (amendingEncounter) {
      setActiveEncounterId(amendingEncounter.EncounterID);
      setIsDetailsModalOpen(true);
    }
  };

  return (
    <ClinicalLayout
      activeTab={activeTab}
      onSelectTab={(tab) => {
        if (tab !== 'profile' && tab !== 'new-encounter') {
          // Keep patient context if returning to profile, otherwise navigate
        }
        setActiveTab(tab);
      }}
      selectedPatientName={selectedPatientId ? selectedPatientName || `Patient #${selectedPatientId}` : null}
    >
      {/* Tab: Clinical Dashboard */}
      {activeTab === 'dashboard' && (
        <ClinicalDashboard
          onNavigateTab={(tab, patientId) => {
            if (patientId) setSelectedPatientId(patientId);
            setActiveTab(tab);
          }}
          onSelectEncounter={handleOpenEncounterDetails}
        />
      )}

      {/* Tab: Patient Registry */}
      {activeTab === 'registry' && (
        <PatientRegistry
          onSelectPatient={(id) => handleSelectPatient(id)}
          onStartConsultation={(id) => handleStartConsultation(id)}
        />
      )}

      {/* Tab: New Clinical Consultation */}
      {activeTab === 'new-encounter' && (
        <NewEncounterView
          initialPatientId={selectedPatientId}
          onEncounterCreated={handleEncounterCreated}
          onCancel={() => {
            if (selectedPatientId) setActiveTab('profile');
            else setActiveTab('dashboard');
          }}
        />
      )}

      {/* Tab: Consultation History */}
      {activeTab === 'encounters' && (
        <EncounterHistoryView
          onSelectEncounter={handleOpenEncounterDetails}
          onStartConsultation={() => handleStartConsultation()}
          onSelectPatient={(id) => handleSelectPatient(id)}
        />
      )}

      {/* Tab: Patient Profile & Unified History */}
      {activeTab === 'profile' && selectedPatientId && (
        <PatientProfileView
          patientId={selectedPatientId}
          onBack={() => setActiveTab('registry')}
          onStartConsultation={(id) => handleStartConsultation(id)}
          onSelectEncounter={handleOpenEncounterDetails}
        />
      )}

      {/* Modal: Encounter Full Details & Printable Record */}
      <EncounterDetailsModal
        encounterId={activeEncounterId}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setActiveEncounterId(null);
        }}
        onEncounterFinalized={() => {
          // Trigger refresh if needed
        }}
        onOpenAmendModal={handleOpenAmendModal}
      />

      {/* Modal: Clinical Record Amendment with Audit Reason */}
      {amendingEncounter && (
        <AmendEncounterModal
          encounter={amendingEncounter}
          isOpen={isAmendModalOpen}
          onClose={() => {
            setIsAmendModalOpen(false);
            setAmendingEncounter(null);
          }}
          onSuccess={handleAmendSuccess}
        />
      )}
    </ClinicalLayout>
  );
}

export default ClinicalModule;
