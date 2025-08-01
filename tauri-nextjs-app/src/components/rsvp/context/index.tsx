"use client";

import { createContext, useContext, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RSVPState, RSVPSettings, RSVPContextValue } from "../types";
import { useRSVPState, useSettings, useTauriEvents, useKeyboardEvents, useReadingTimer } from "../hooks";
import { ClipboardService, StatePersistenceService, hashString, RSVPCalculationService } from "../services";

const RSVPContext = createContext<RSVPContextValue | null>(null);

export const useRSVP = () => {
  const context = useContext(RSVPContext);
  if (!context) {
    throw new Error("useRSVP must be used within an RSVPProvider");
  }
  return context;
};

interface RSVPProviderProps {
  children: React.ReactNode;
}

export const RSVPProvider = ({ children }: RSVPProviderProps) => {
  const { state, updateState } = useRSVPState();
  const { settings, updateSetting } = useSettings();
  const { isWindowVisible } = useTauriEvents();

  const saveCurrentProjectProgress = () => {
    try {
      const saved = localStorage.getItem('rsvp-projects');
      if (saved && state.isDisplayingWords && state.clipboardHash) {
        const projects = JSON.parse(saved);
        const currentProject = projects.find((p: any) => p.id === state.clipboardHash);

        if (currentProject) {
          const updatedProject = {
            ...currentProject,
            currentWordIndex: state.currentWordIndex,
            lastRead: new Date()
          };

          const updatedProjects = projects.map((p: any) =>
            p.id === state.clipboardHash ? updatedProject : p
          );

          localStorage.setItem('rsvp-projects', JSON.stringify(updatedProjects));
        }
      }
    } catch (error) {
      console.error('Failed to save project progress:', error);
    }
  };

  // Load persisted state on mount
  useEffect(() => {
    const saved = StatePersistenceService.load();
    if (saved) {
      updateState(saved.state);
      Object.entries(saved.settings).forEach(([key, value]) => {
        updateSetting(key as keyof RSVPSettings, value);
      });
    }
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    StatePersistenceService.save(state, settings);
  }, [state, settings]);

  // Save progress when starting/stopping reading
  useEffect(() => {
    if (state.isDisplayingWords) {
      saveCurrentProjectProgress();
    }
  }, [state.isPlaying]);

  // Handle window visibility changes
  useEffect(() => {
    if (isWindowVisible) {
      handleWindowShow();
    } else {
      handleWindowHide();
    }
  }, [isWindowVisible]);

  const handleWindowShow = async () => {
    const text = await ClipboardService.readContent();
    if (text) {
      const newHash = hashString(text);

      if (newHash !== state.clipboardHash) {
        console.log('Clipboard content changed, resetting state');
        displayWords(text, newHash);
      } else {
        console.log('Clipboard content unchanged, restoring state');
        updateState({ isDisplayingWords: true, isPlaying: false });
      }
    }
  };

  const handleWindowHide = () => {
    // Save progress when hiding window
    saveCurrentProjectProgress();
    updateState({ isPlaying: false });
  };

  const handleSpaceKey = () => {
    if (state.currentWordIndex >= state.words.length) {
      updateState({ currentWordIndex: 0, isPlaying: true });
    } else if (state.isPlaying) {
      updateState({ isPlaying: false });
    } else {
      updateState({ isPlaying: true });
    }
  };

  const handleFocusedShortcut = (key: string) => {
    switch (key) {
      case 'J':
        const newIndexBack = Math.max(0, state.currentWordIndex - 10);
        updateState({ currentWordIndex: newIndexBack });
        break;
      case 'K':
        handleSpaceKey();
        break;
      case 'L':
        const newIndexForward = Math.min(state.words.length - 1, state.currentWordIndex + 10);
        updateState({ currentWordIndex: newIndexForward });
        break;
    }
  };

  const displayWords = (text: string, hash: string) => {
    const { words, maxLength } = RSVPCalculationService.processText(text);
    updateState({
      words,
      currentWordIndex: 0,
      maxWordLength: maxLength,
      clipboardHash: hash,
      isDisplayingWords: true,
      isPlaying: false
    });
  };

  const loadProjectWithProgress = (text: string, hash: string, savedProgress: number) => {
    const { words, maxLength } = RSVPCalculationService.processText(text);
    updateState({
      words,
      currentWordIndex: savedProgress,
      maxWordLength: maxLength,
      clipboardHash: hash,
      isDisplayingWords: true,
      isPlaying: false
    });
  };

  const handleHide = async () => {
    // Save progress before hiding
    saveCurrentProjectProgress();
    await invoke('hide_window');
    updateState({ isDisplayingWords: false, words: [] });
    StatePersistenceService.clear();
  };

  useKeyboardEvents(state.isDisplayingWords, handleSpaceKey, handleFocusedShortcut);
  useReadingTimer(state, settings, updateState);

  const contextValue: RSVPContextValue = {
    state,
    settings,
    updateState,
    updateSettings: updateSetting,
    displayWords,
    loadProjectWithProgress,
    handleHide
  };

  return (
    <RSVPContext.Provider value={contextValue}>
      {children}
    </RSVPContext.Provider>
  );
};