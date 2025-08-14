'use client';

import { useState } from 'react';
import { RSVPProvider, useRSVP } from './new-context';
import { FileManager } from './components/file-manager';
import { SimpleRSVPDisplay } from './components/simple-rsvp-display';
import { SimpleSettings } from './components/simple-settings';
import { DictionaryModal } from './components/dictionary-modal';
import { FileMetadata } from '@/lib/tauri-file-api';

function AppContent() {
  const { loadProject, state, closeDictionaryModal } = useRSVP();

  const handleProjectSelected = async (project: FileMetadata, wordIndex: number) => {
    await loadProject(project, wordIndex);
  };

    return (
    <div className="h-screen flex bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800">
      <FileManager
        onProjectSelected={handleProjectSelected}
        currentProjectId={state.currentProject?.id}
      />
      <SimpleRSVPDisplay />
      <SimpleSettings />

      <DictionaryModal
        isOpen={state.dictionaryModalOpen}
        onClose={closeDictionaryModal}
        word={state.selectedWord}
      />
    </div>
  );
}

export function SimpleApp() {
  return (
    <RSVPProvider>
      <AppContent />
    </RSVPProvider>
  );
}