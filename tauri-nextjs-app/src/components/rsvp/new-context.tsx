'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TauriFileAPI, FileMetadata, ProjectSettings } from '@/lib/tauri-file-api';

interface RSVPState {
  words: string[];
  currentWordIndex: number;
  maxWordLength: number;
  isDisplayingWords: boolean;
  isPlaying: boolean;
  currentProject: FileMetadata | null;
  globalWordIndex: number;
}

interface RSVPSettings {
  timePerWord: number;
  timePerCharacter: number;
  highlightORP: boolean;
  letterSpacing: number;
  punctuationDelay: number;
  trailWordsCount: number;
  chunkSize: number;
  skillLevel: number;
}

interface RSVPContextType {
  state: RSVPState;
  settings: RSVPSettings;
  updateSetting: <K extends keyof RSVPSettings>(key: K, value: RSVPSettings[K]) => void;
  loadProject: (project: FileMetadata, startWordIndex: number) => Promise<void>;
  playPause: () => void;
  resetToStart: () => void;
  nextWord: () => void;
  previousWord: () => void;
  jumpToWord: (wordIndex: number) => void;
  loadClipboard: () => Promise<void>;
}

const RSVPContext = createContext<RSVPContextType | undefined>(undefined);

const BUFFER_SIZE = 1000;
const SAVE_INTERVAL = 2000; // Save progress every 2 seconds

export function RSVPProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RSVPState>({
    words: [],
    currentWordIndex: 0,
    maxWordLength: 0,
    isDisplayingWords: false,
    isPlaying: false,
    currentProject: null,
    globalWordIndex: 0,
  });

  const [settings, setSettings] = useState<RSVPSettings>({
    timePerWord: 35, // Word delay: 35ms default
    timePerCharacter: 25, // Character delay: 25ms default
    highlightORP: true,
    letterSpacing: 3.5,
    punctuationDelay: 50, // Punctuation delay: 50ms default
    trailWordsCount: 5,
    chunkSize: 1,
    skillLevel: 1,
  });

  const [wordBuffer, setWordBuffer] = useState<string[]>([]);
  const [bufferStartIndex, setBufferStartIndex] = useState(0);

  // Helper functions to convert between settings formats
  const convertToProjectSettings = (rsvpSettings: RSVPSettings): ProjectSettings => ({
    time_per_word: rsvpSettings.timePerWord,
    time_per_character: rsvpSettings.timePerCharacter,
    highlight_orp: rsvpSettings.highlightORP,
    letter_spacing: rsvpSettings.letterSpacing,
    punctuation_delay: rsvpSettings.punctuationDelay,
    trail_words_count: rsvpSettings.trailWordsCount,
    chunk_size: rsvpSettings.chunkSize,
    skill_level: rsvpSettings.skillLevel,
  });

  const convertFromProjectSettings = (projectSettings: ProjectSettings): RSVPSettings => ({
    timePerWord: projectSettings.time_per_word,
    timePerCharacter: projectSettings.time_per_character,
    highlightORP: projectSettings.highlight_orp,
    letterSpacing: projectSettings.letter_spacing,
    punctuationDelay: projectSettings.punctuation_delay,
    trailWordsCount: projectSettings.trail_words_count,
    chunkSize: projectSettings.chunk_size,
    skillLevel: projectSettings.skill_level,
  });

    // Save progress function
  const saveProgress = useCallback(async () => {
    if (!state.currentProject || !state.isDisplayingWords) return;

    try {
      const actualGlobalIndex = bufferStartIndex + state.currentWordIndex;
      console.log('Saving progress:', {
        projectId: state.currentProject.id,
        bufferStartIndex,
        currentWordIndex: state.currentWordIndex,
        actualGlobalIndex
      });

      await TauriFileAPI.updateProjectProgress(
        state.currentProject,
        actualGlobalIndex
      );

      // Dispatch event to update file manager
      window.dispatchEvent(new CustomEvent('project-progress-updated', {
        detail: {
          projectId: state.currentProject.id,
          currentWordIndex: actualGlobalIndex
        }
      }));
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [state.currentProject, state.isDisplayingWords, state.currentWordIndex, bufferStartIndex]);

  // Auto-save progress on intervals
  useEffect(() => {
    if (!state.currentProject || !state.isDisplayingWords) return;

    const interval = setInterval(saveProgress, SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [saveProgress]);

  // Immediate save on play/pause state changes
  useEffect(() => {
    if (state.currentProject && state.isDisplayingWords) {
      saveProgress();
    }
  }, [state.isPlaying, saveProgress]);

  // Load word buffer when needed
  const loadWordBuffer = useCallback(async (project: FileMetadata, startIndex: number) => {
    try {
      const buffer = await TauriFileAPI.loadWordBuffer(
        project.saved_path,
        startIndex,
        BUFFER_SIZE
      );

      setWordBuffer(buffer);
      setBufferStartIndex(startIndex);

      // Update words in state
      setState(prev => ({
        ...prev,
        words: buffer,
        maxWordLength: Math.max(...buffer.map(word => word.length), prev.maxWordLength),
      }));

      return buffer;
    } catch (error) {
      console.error('Failed to load word buffer:', error);
      return [];
    }
  }, []);

  // Load more words when approaching buffer end
  const ensureBufferAvailable = useCallback(async () => {
    if (!state.currentProject) return;

    const relativeIndex = state.globalWordIndex - bufferStartIndex;
    const bufferEndIndex = bufferStartIndex + wordBuffer.length;

    // Load more if we're near the end and there are more words
    if (relativeIndex > wordBuffer.length - 200 &&
        bufferEndIndex < state.currentProject.total_words) {

      try {
        const nextBuffer = await TauriFileAPI.loadWordBuffer(
          state.currentProject.saved_path,
          bufferEndIndex,
          BUFFER_SIZE
        );

        if (nextBuffer.length > 0) {
          const combinedBuffer = [...wordBuffer, ...nextBuffer];
          setWordBuffer(combinedBuffer);

          setState(prev => ({
            ...prev,
            words: combinedBuffer,
            maxWordLength: Math.max(...nextBuffer.map(word => word.length), prev.maxWordLength),
          }));
        }
      } catch (error) {
        console.error('Failed to load additional buffer:', error);
      }
    }
  }, [state.currentProject, state.globalWordIndex, bufferStartIndex, wordBuffer]);

  const updateSetting = useCallback(<K extends keyof RSVPSettings>(
    key: K,
    value: RSVPSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Save settings for current project
    if (state.currentProject) {
      const projectSettings = convertToProjectSettings(newSettings);
      TauriFileAPI.saveProjectSettings(state.currentProject.id, projectSettings);
    }
  }, [settings, state.currentProject, convertToProjectSettings]);

    const loadProject = useCallback(async (project: FileMetadata, startWordIndex: number) => {
    try {
      // Load project settings
      const projectSettings = await TauriFileAPI.loadProjectSettings(project.id);
      if (projectSettings) {
        const rsvpSettings = convertFromProjectSettings(projectSettings);
        setSettings(rsvpSettings);
        console.log('Loaded project settings:', rsvpSettings);
      } else {
        // Use default settings for new projects
        const defaultSettings = convertFromProjectSettings(TauriFileAPI.getDefaultSettings());
        setSettings(defaultSettings);
        console.log('Using default settings for new project');
      }

      // Load initial buffer
      await loadWordBuffer(project, startWordIndex);

      const relativeIndex = 0; // Start at beginning of loaded buffer

      setState(prev => ({
        ...prev,
        currentProject: project,
        globalWordIndex: startWordIndex,
        currentWordIndex: relativeIndex,
        isDisplayingWords: true,
        isPlaying: false,
      }));

    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }, [loadWordBuffer, convertFromProjectSettings]);

  const playPause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const resetToStart = useCallback(async () => {
    if (!state.currentProject) return;

    await loadProject(state.currentProject, 0);
  }, [state.currentProject, loadProject]);

    const nextWord = useCallback(async () => {
    if (!state.currentProject) return;

    const currentGlobalIndex = bufferStartIndex + state.currentWordIndex;
    const newGlobalIndex = Math.min(
      currentGlobalIndex + 1,
      state.currentProject.total_words - 1
    );

    const newRelativeIndex = newGlobalIndex - bufferStartIndex;

    setState(prev => ({
      ...prev,
      globalWordIndex: newGlobalIndex,
      currentWordIndex: newRelativeIndex,
    }));

    await ensureBufferAvailable();
  }, [state.currentProject, state.currentWordIndex, bufferStartIndex, ensureBufferAvailable]);

  const previousWord = useCallback(() => {
    const currentGlobalIndex = bufferStartIndex + state.currentWordIndex;
    const newGlobalIndex = Math.max(currentGlobalIndex - 1, 0);
    const newRelativeIndex = newGlobalIndex - bufferStartIndex;

    setState(prev => ({
      ...prev,
      globalWordIndex: newGlobalIndex,
      currentWordIndex: newRelativeIndex,
    }));
  }, [state.currentWordIndex, bufferStartIndex]);

  const jumpToWord = useCallback(async (wordIndex: number) => {
    if (!state.currentProject) return;

    const clampedIndex = Math.max(0, Math.min(wordIndex, state.currentProject.total_words - 1));

    // Check if we need to load a different buffer
    if (clampedIndex < bufferStartIndex || clampedIndex >= bufferStartIndex + wordBuffer.length) {
      await loadWordBuffer(state.currentProject, clampedIndex);
    }

    const newRelativeIndex = clampedIndex - bufferStartIndex;

    setState(prev => ({
      ...prev,
      globalWordIndex: clampedIndex,
      currentWordIndex: newRelativeIndex,
    }));
  }, [state.currentProject, bufferStartIndex, wordBuffer.length, loadWordBuffer]);

  const loadClipboard = useCallback(async () => {
    try {
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
      const text = await readText();

      if (text) {
        const words = text.split(/\s+/).filter(word => word.length > 0);

        setState(prev => ({
          ...prev,
          words,
          currentWordIndex: 0,
          maxWordLength: Math.max(...words.map(word => word.length)),
          isDisplayingWords: true,
          isPlaying: false,
          currentProject: null,
          globalWordIndex: 0,
        }));

        setWordBuffer(words);
        setBufferStartIndex(0);
      }
    } catch (error) {
      console.error('Failed to load clipboard:', error);
    }
  }, []);

  // Auto-advance words when playing
  useEffect(() => {
    if (!state.isPlaying || !state.isDisplayingWords) return;

    const currentWord = state.words[state.currentWordIndex];
    if (!currentWord) return;

    const baseTime = settings.timePerWord + (currentWord.length * settings.timePerCharacter);
    const punctuationMultiplier = /[.!?]/.test(currentWord) ? (1 + settings.punctuationDelay / 100) : 1;
    const delay = baseTime * punctuationMultiplier;

    const timeout = setTimeout(() => {
      nextWord();
    }, delay);

    return () => clearTimeout(timeout);
  }, [state.isPlaying, state.isDisplayingWords, state.currentWordIndex, state.words, settings, nextWord]);

  const contextValue: RSVPContextType = {
    state,
    settings,
    updateSetting,
    loadProject,
    playPause,
    resetToStart,
    nextWord,
    previousWord,
    jumpToWord,
    loadClipboard,
  };

  return (
    <RSVPContext.Provider value={contextValue}>
      {children}
    </RSVPContext.Provider>
  );
}

export function useRSVP() {
  const context = useContext(RSVPContext);
  if (context === undefined) {
    throw new Error('useRSVP must be used within an RSVPProvider');
  }
  return context;
}