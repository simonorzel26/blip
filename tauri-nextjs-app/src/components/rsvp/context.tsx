"use client";

import { createContext, useContext, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RSVPState, RSVPSettings, RSVPContextValue } from "./types";
import { useRSVPState, useSettings, useTauriEvents, useKeyboardEvents, useReadingTimer } from "./hooks";
import { RSVPCalculationService, StatePersistenceService, FileProcessingService, ClipboardService, hashString, FileBasedReader } from "./services";

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
  const fileReader = useRef<FileBasedReader>(new FileBasedReader());

  const saveCurrentProjectProgress = useCallback(() => {
    try {
      const projectId = localStorage.getItem('current-project-id');
      if (projectId && state.isDisplayingWords) {
        // Save current word position
        const globalWordPosition = state.currentWordIndex;

        // Save to projects list
        const saved = localStorage.getItem('file-projects');
        if (saved) {
          const projects = JSON.parse(saved);
          const currentProject = projects.find((p: any) => p.id === projectId);

          if (currentProject) {
            const updatedProject = {
              ...currentProject,
              lastRead: globalWordPosition,
              lastReadDate: new Date().toISOString()
            };

            const updatedProjects = projects.map((p: any) =>
              p.id === projectId ? updatedProject : p
            );

            localStorage.setItem('file-projects', JSON.stringify(updatedProjects));
          }
        }
      }
    } catch (error) {
      console.error('Failed to save project progress:', error);
    }
  }, [state.isDisplayingWords, state.currentWordIndex]);

  const displayWords = useCallback(async (filePath: string, hash: string) => {
    try {
      // Load file metadata
      const { totalWords, estimatedPages } = await fileReader.current.loadFile(filePath);

      // Get first batch of words (starting from position 0)
      const words = await fileReader.current.getWords(0, 1000);

      updateState({
        words,
        currentWordIndex: 0, // Start from beginning for new files
        maxWordLength: Math.max(...words.map(word => word.length)),
        clipboardHash: hash,
        isDisplayingWords: true,
        isPlaying: false
      });
    } catch (error) {
      console.error('Failed to display words:', error);
    }
  }, [updateState]);

  const loadProjectWithProgress = useCallback(async (project: any) => {
    try {
      // Load file metadata
      const { totalWords, estimatedPages } = await fileReader.current.loadFile(project.filePath);

      // Get saved progress position
      const savedProgress = project.lastRead || 0;
      const startIndex = Math.min(savedProgress, totalWords - 1);

      // Load words starting from the saved position
      const words = await fileReader.current.getWords(startIndex, 1000);

      // Update localStorage with current position
      localStorage.setItem('current-project-id', project.id);
      localStorage.setItem('current-project-chunk', '0');
      localStorage.setItem('current-project-file-path', project.filePath);
      localStorage.setItem('current-project-total-chunks', '1');
      localStorage.setItem('current-project-total-words', totalWords.toString());
      localStorage.setItem('current-project-chunk-size', totalWords.toString());

      // Update state with the saved word position
      // The currentWordIndex should represent the global position, not local position
      updateState({
        words,
        currentWordIndex: savedProgress, // Use the global position
        maxWordLength: Math.max(...words.map(word => word.length)),
        clipboardHash: project.id,
        isDisplayingWords: true,
        isPlaying: false
      });
    } catch (error) {
      console.error('Failed to load project with progress:', error);
    }
  }, [updateState]);

  // Load next chunk when reaching end of current chunk
  const loadNextChunk = useCallback(async () => {
    // No more chunks needed - we have the full file
    updateState({ isPlaying: false });
  }, [updateState]);

  const loadMoreWords = useCallback(async (currentIndex: number) => {
    try {
      const filePath = localStorage.getItem('current-project-file-path');
      if (!filePath) return;

      // If we're approaching the end of loaded words, load more
      if (currentIndex >= state.words.length - 100) {
        const nextBatchStart = state.words.length;
        const newWords = await fileReader.current.getWords(nextBatchStart, 1000);

        if (newWords.length > 0) {
          // Keep the current word index (it represents global position)
          const currentGlobalIndex = state.currentWordIndex;

          updateState({
            words: [...state.words, ...newWords],
            maxWordLength: Math.max(state.maxWordLength, ...newWords.map(word => word.length)),
            currentWordIndex: currentGlobalIndex // Maintain the same position
          });
        }
      }
    } catch (error) {
      console.error('Failed to load more words:', error);
    }
  }, [state.words, state.maxWordLength, state.currentWordIndex, updateState]);

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

  // Listen for file-loaded events from the file explorer
  useEffect(() => {
    const handleFileLoaded = (event: CustomEvent) => {
      const { filePath, id, chunkIndex, totalChunks, wordCount, estimatedPages } = event.detail;
      displayWords(filePath, id);

      // Store chunk info for later use
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

  // Check for file content in localStorage on mount
  useEffect(() => {
    const projectId = localStorage.getItem('current-project-id');
    const chunkIndex = localStorage.getItem('current-project-chunk');
    const filePath = localStorage.getItem('current-project-file-path');

    if (projectId && chunkIndex !== null && filePath) {
      // Load the current chunk from file
      const loadCurrentChunk = async () => {
        try {
          const { readTextFile } = await import('@tauri-apps/plugin-fs');
          const content = await readTextFile(filePath);

          displayWords(filePath, projectId);
        } catch (error) {
          console.error('Failed to load current chunk:', error);
          // Clear the stored file path if access is forbidden
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

  // Save state whenever it changes
  useEffect(() => {
    StatePersistenceService.save(state, settings);
  }, [state, settings]);

  // Save progress when starting/stopping reading
  useEffect(() => {
    if (state.isDisplayingWords) {
      saveCurrentProjectProgress();
    }
  }, [state.isPlaying, saveCurrentProjectProgress]);

  // Save progress periodically during reading
  useEffect(() => {
    if (state.isPlaying && state.isDisplayingWords) {
      const interval = setInterval(() => {
        saveCurrentProjectProgress();
      }, 2000); // Save every 2 seconds during reading

      return () => clearInterval(interval);
    }
  }, [state.isPlaying, state.isDisplayingWords, saveCurrentProjectProgress]);

  // Save progress when word index changes
  useEffect(() => {
    if (state.isDisplayingWords && state.currentWordIndex > 0) {
      const timeoutId = setTimeout(() => {
        saveCurrentProjectProgress();
      }, 500); // Save 500ms after word index changes

      return () => clearTimeout(timeoutId);
    }
  }, [state.currentWordIndex, state.isDisplayingWords, saveCurrentProjectProgress]);

  // Load more words when approaching end of loaded words
  useEffect(() => {
    if (state.isDisplayingWords && state.currentWordIndex > 0) {
      loadMoreWords(state.currentWordIndex);
    }
  }, [state.currentWordIndex, state.isDisplayingWords, loadMoreWords]);

  // Handle window visibility changes
  useEffect(() => {
    if (isWindowVisible) {
      handleWindowShow();
    } else {
      handleWindowHide();
    }
  }, [isWindowVisible]);

  const handleWindowShow = useCallback(async () => {
    const text = await ClipboardService.readContent();
    if (text) {
      const newHash = hashString(text);

      if (newHash !== state.clipboardHash) {
        console.log('Clipboard content changed, resetting state');
        // For clipboard content, we'll need to handle it differently
        // For now, just update the hash
        updateState({ clipboardHash: newHash });
      } else {
        console.log('Clipboard content unchanged, restoring state');
      }
    }
  }, [state.clipboardHash, updateState]);

  const handleWindowHide = useCallback(() => {
    // Save progress when hiding window
    saveCurrentProjectProgress();
    updateState({ isPlaying: false });
  }, [saveCurrentProjectProgress, updateState]);

  const handleSpaceKey = useCallback(() => {
    if (state.currentWordIndex >= state.words.length) {
      updateState({ currentWordIndex: 0, isPlaying: true });
    } else if (state.isPlaying) {
      updateState({ isPlaying: false });
      // Save progress when stopping
      setTimeout(() => saveCurrentProjectProgress(), 100);
    } else {
      updateState({ isPlaying: true });
    }
  }, [state.currentWordIndex, state.words.length, state.isPlaying, updateState, saveCurrentProjectProgress]);

  const handleFocusedShortcut = useCallback((key: string) => {
    switch (key) {
      case 'J':
        if (state.currentWordIndex > 0) {
          updateState({ currentWordIndex: state.currentWordIndex - 1 });
          // Save progress when manually navigating
          setTimeout(() => saveCurrentProjectProgress(), 100);
        }
        break;
      case 'K':
        if (state.currentWordIndex < state.words.length - 1) {
          updateState({ currentWordIndex: state.currentWordIndex + 1 });
          // Save progress when manually navigating
          setTimeout(() => saveCurrentProjectProgress(), 100);
        }
        break;
      case 'L':
        updateState({ isPlaying: !state.isPlaying });
        break;
    }
  }, [state.currentWordIndex, state.words.length, updateState, saveCurrentProjectProgress]);

  const handleHide = useCallback(async () => {
    // Save progress before hiding
    saveCurrentProjectProgress();
    await invoke('hide_window');
    updateState({ isDisplayingWords: false, words: [] });
    StatePersistenceService.clear();
  }, [saveCurrentProjectProgress, updateState]);

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