"use client";

import { createContext, useContext, useEffect, useCallback, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RSVPState, RSVPSettings, RSVPContextValue } from "./types";
import { useRSVPState, useSettings, useTauriEvents, useKeyboardEvents, useReadingTimer } from "./hooks";
import { RSVPCalculationService, StatePersistenceService, FileSystemService, ClipboardService, hashString, FileBasedReader } from "./services";

const RSVPContext = createContext<RSVPContextValue | null>(null);

export const useRSVP = () => {
  const context = useContext(RSVPContext);
  if (!context) {
    throw new Error('useRSVP must be used within RSVPProvider');
  }
  return context;
};

interface RSVPProviderProps {
  children: React.ReactNode;
}

interface FileProject {
  id: string;
  name: string;
  filePath: string;
  wordCount: number;
  lastRead: number;
  createdAt: string;
  chunkSize: number;
  totalChunks: number;
  estimatedPages: number;
}

// Single Responsibility: Progress saving
class ProgressSaver {
  static saveProjectProgress(projectId: string, currentWordIndex: number): void {
    try {
      const saved = localStorage.getItem('file-projects');
      if (saved) {
        const projects = JSON.parse(saved);
        const currentProject = projects.find((p: any) => p.id === projectId);

        if (currentProject) {
          const updatedProject = {
            ...currentProject,
            lastRead: currentWordIndex,
            lastReadDate: new Date().toISOString()
          };

          const updatedProjects = projects.map((p: any) =>
            p.id === projectId ? updatedProject : p
          );

          localStorage.setItem('file-projects', JSON.stringify(updatedProjects));

          // Dispatch event to update sidebar
          window.dispatchEvent(new CustomEvent('project-progress-updated', {
            detail: { projectId, currentWordIndex, updatedProject }
          }));
        }
      }
    } catch (error) {
      console.error('Failed to save project progress:', error);
    }
  }
}

// Single Responsibility: File operations
class FileOperations {
  constructor(private fileReader: FileBasedReader) {}

  async loadNewFile(filePath: string, hash: string, updateState: (updates: Partial<RSVPState>) => void): Promise<void> {
    try {
      const { totalWords, estimatedPages } = await this.fileReader.loadFile(filePath);
      const words = await this.fileReader.getWords(0, 1000);

      updateState({
        words,
        currentWordIndex: 0,
        maxWordLength: Math.max(...words.map(word => word.length)),
        clipboardHash: hash,
        isDisplayingWords: true,
        isPlaying: false
      });
    } catch (error) {
      console.error('Failed to display words:', error);
    }
  }

  async loadProjectWithProgress(project: any, updateState: (updates: Partial<RSVPState>) => void): Promise<void> {
    try {
      const { totalWords, estimatedPages } = await this.fileReader.loadFile(project.filePath);
      const savedProgress = project.lastRead || 0;
      const startIndex = Math.min(savedProgress, totalWords - 1);
      const words = await this.fileReader.getWords(startIndex, 1000);

      this.updateLocalStorage(project.id, project.filePath, totalWords);

      updateState({
        words,
        currentWordIndex: savedProgress,
        maxWordLength: Math.max(...words.map(word => word.length)),
        clipboardHash: project.id,
        isDisplayingWords: true,
        isPlaying: false
      });
    } catch (error) {
      console.error('Failed to load project with progress:', error);
    }
  }

  private updateLocalStorage(projectId: string, filePath: string, totalWords: number): void {
    localStorage.setItem('current-project-id', projectId);
    localStorage.setItem('current-project-chunk', '0');
    localStorage.setItem('current-project-file-path', filePath);
    localStorage.setItem('current-project-total-chunks', '1');
    localStorage.setItem('current-project-total-words', totalWords.toString());
    localStorage.setItem('current-project-chunk-size', totalWords.toString());
  }
}

// Single Responsibility: Word loading
class WordLoader {
  constructor(private fileReader: FileBasedReader) {}

  async loadMoreWords(currentIndex: number, currentWords: string[], maxWordLength: number, updateState: (updates: Partial<RSVPState>) => void): Promise<void> {
    try {
      const filePath = localStorage.getItem('current-project-file-path');
      if (!filePath) return;

      if (currentIndex >= currentWords.length - 100) {
        const nextBatchStart = currentWords.length;
        const newWords = await this.fileReader.getWords(nextBatchStart, 1000);

        if (newWords.length > 0) {
          const currentGlobalIndex = currentIndex;

          updateState({
            words: [...currentWords, ...newWords],
            maxWordLength: Math.max(maxWordLength, ...newWords.map(word => word.length)),
            currentWordIndex: currentGlobalIndex
          });
        }
      }
    } catch (error) {
      console.error('Failed to load more words:', error);
    }
  }
}

export const RSVPProvider = ({ children }: RSVPProviderProps) => {
  const { state, updateState } = useRSVPState();
  const { settings, updateSetting } = useSettings();
  const { isWindowVisible } = useTauriEvents();

  const fileReader = useRef<FileBasedReader>(new FileBasedReader());
  const fileOperations = useRef<FileOperations>(new FileOperations(fileReader.current));
  const wordLoader = useRef<WordLoader>(new WordLoader(fileReader.current));

  const saveCurrentProjectProgress = useCallback(() => {
    const projectId = localStorage.getItem('current-project-id');
    if (projectId && state.isDisplayingWords) {
      ProgressSaver.saveProjectProgress(projectId, state.currentWordIndex);
    }
  }, [state.isDisplayingWords, state.currentWordIndex]);

  const displayWords = useCallback(async (filePath: string, hash: string) => {
    await fileOperations.current.loadNewFile(filePath, hash, updateState);
  }, [updateState]);

  const loadProjectWithProgress = useCallback(async (project: any) => {
    await fileOperations.current.loadProjectWithProgress(project, updateState);
  }, [updateState]);

  const loadMoreWords = useCallback(async (currentIndex: number) => {
    await wordLoader.current.loadMoreWords(currentIndex, state.words, state.maxWordLength, updateState);
  }, [state.words, state.maxWordLength, updateState]);

  const loadNextChunk = useCallback(async () => {
    updateState({ isPlaying: false });
  }, [updateState]);

  const handleSpaceKey = useCallback(() => {
    if (state.currentWordIndex >= state.words.length) {
      updateState({ currentWordIndex: 0, isPlaying: true });
      setTimeout(() => saveCurrentProjectProgress(), 100);
    } else if (state.isPlaying) {
      updateState({ isPlaying: false });
      setTimeout(() => saveCurrentProjectProgress(), 100);
    } else {
      updateState({ isPlaying: true });
      setTimeout(() => saveCurrentProjectProgress(), 100);
    }
  }, [state.currentWordIndex, state.words.length, state.isPlaying, updateState, saveCurrentProjectProgress]);

  const handleFocusedShortcut = useCallback((key: string) => {
    switch (key) {
      case 'J':
        if (state.currentWordIndex > 0) {
          updateState({ currentWordIndex: state.currentWordIndex - 1 });
          setTimeout(() => saveCurrentProjectProgress(), 100);
        }
        break;
      case 'K':
        if (state.currentWordIndex < state.words.length - 1) {
          updateState({ currentWordIndex: state.currentWordIndex + 1 });
          setTimeout(() => saveCurrentProjectProgress(), 100);
        }
        break;
      case 'L':
        updateState({ isPlaying: !state.isPlaying });
        break;
    }
  }, [state.currentWordIndex, state.words.length, updateState, saveCurrentProjectProgress]);

  const handleWindowShow = useCallback(async () => {
    const text = await ClipboardService.readContent();
    if (text) {
      const newHash = hashString(text);
      if (newHash !== state.clipboardHash) {
        updateState({ clipboardHash: newHash });
      }
    }
  }, [state.clipboardHash, updateState]);

  const handleWindowHide = useCallback(() => {
    saveCurrentProjectProgress();
    updateState({ isPlaying: false });
  }, [saveCurrentProjectProgress, updateState]);

  const handleHide = useCallback(async () => {
    saveCurrentProjectProgress();
    await invoke('hide_window');
    updateState({ isDisplayingWords: false, words: [] });
    StatePersistenceService.clear();
  }, [saveCurrentProjectProgress, updateState]);

  // Effects
  useEffect(() => {
    const saved = StatePersistenceService.load();
    if (saved) {
      updateState(saved.state);
      Object.entries(saved.settings).forEach(([key, value]) => {
        updateSetting(key as keyof RSVPSettings, value);
      });
    }
  }, []);

  useEffect(() => {
    const handleFileLoaded = (event: CustomEvent) => {
      const { filePath, id, chunkIndex, totalChunks, wordCount, estimatedPages } = event.detail;
      displayWords(filePath, id);

      localStorage.setItem('current-project-id', id);
      localStorage.setItem('current-project-chunk', chunkIndex.toString());
      localStorage.setItem('current-project-file-path', filePath);
      localStorage.setItem('current-project-total-chunks', totalChunks.toString());
      localStorage.setItem('current-project-total-words', wordCount.toString());
    };

    const handleLoadProjectWithProgress = (event: CustomEvent) => {
      const { project } = event.detail;
      loadProjectWithProgress(project);
    };

    window.addEventListener('file-loaded', handleFileLoaded as EventListener);
    window.addEventListener('load-project-with-progress', handleLoadProjectWithProgress as EventListener);

    return () => {
      window.removeEventListener('file-loaded', handleFileLoaded as EventListener);
      window.removeEventListener('load-project-with-progress', handleLoadProjectWithProgress as EventListener);
    };
  }, [displayWords, loadProjectWithProgress]);

  useEffect(() => {
    const projectId = localStorage.getItem('current-project-id');
    const chunkIndex = localStorage.getItem('current-project-chunk');
    const filePath = localStorage.getItem('current-project-file-path');

    if (projectId && chunkIndex !== null && filePath) {
      const loadCurrentChunk = async () => {
        try {
          const content = await FileSystemService.readTextFile(filePath);
          displayWords(filePath, projectId);
        } catch (error) {
          console.error('Failed to load current chunk:', error);
          if (error && typeof error === 'object' && 'toString' in error && error.toString().includes('forbidden path')) {
            localStorage.removeItem('current-project-file-path');
            localStorage.removeItem('current-project-id');
            console.log('File access forbidden, cleared stored file path');
          }
        }
      };

      loadCurrentChunk();
    }
  }, [displayWords]);

  useEffect(() => {
    if (state.isDisplayingWords) {
      saveCurrentProjectProgress();
    }
  }, [state.isPlaying, saveCurrentProjectProgress]);

  useEffect(() => {
    if (state.isPlaying && state.isDisplayingWords) {
      const interval = setInterval(() => {
        saveCurrentProjectProgress();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [state.isPlaying, state.isDisplayingWords, saveCurrentProjectProgress]);

  useEffect(() => {
    if (state.isDisplayingWords && state.currentWordIndex > 0) {
      const timeoutId = setTimeout(() => {
        saveCurrentProjectProgress();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [state.currentWordIndex, state.isDisplayingWords, saveCurrentProjectProgress]);

  useEffect(() => {
    if (state.isDisplayingWords && state.currentWordIndex > 0) {
      loadMoreWords(state.currentWordIndex);
    }
  }, [state.currentWordIndex, state.isDisplayingWords, loadMoreWords]);

  useEffect(() => {
    if (isWindowVisible) {
      handleWindowShow();
    } else {
      handleWindowHide();
    }
  }, [isWindowVisible, handleWindowShow, handleWindowHide]);

  useKeyboardEvents(state.isDisplayingWords, handleSpaceKey, handleFocusedShortcut);
  useReadingTimer(state, settings, updateState, loadNextChunk, loadMoreWords);

  const contextValue = useMemo<RSVPContextValue>(() => ({
    state,
    settings,
    updateState,
    updateSettings: updateSetting,
    displayWords,
    loadProjectWithProgress,
    handleHide
  }), [state, settings, updateState, updateSetting, displayWords, loadProjectWithProgress, handleHide]);

  return (
    <RSVPContext.Provider value={contextValue}>
      {children}
    </RSVPContext.Provider>
  );
};