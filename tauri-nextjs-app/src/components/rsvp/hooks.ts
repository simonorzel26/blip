import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { RSVPState, RSVPSettings } from "./types";
import { RSVPCalculationService, StatePersistenceService } from "./services";

export const useTauriEvents = () => {
  const [isWindowVisible, setIsWindowVisible] = useState(false);

  useEffect(() => {
    const setupWindowListener = async () => {
      const unlisten = await listen('window-toggled', (event: { payload: { isVisible: boolean } }) => {
        setIsWindowVisible(event.payload.isVisible);
      });
      return unlisten;
    };

    setupWindowListener();
  }, []);

  return { isWindowVisible };
};

export const useRSVPState = () => {
  const [state, setState] = useState<RSVPState>({
    words: [],
    currentWordIndex: 0,
    maxWordLength: 0,
    clipboardHash: '',
    isDisplayingWords: false,
    isPlaying: false
  });

  const updateState = useCallback((updates: Partial<RSVPState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  return { state, updateState };
};

export const useSettings = () => {
  const [settings, setSettings] = useState<RSVPSettings>({
    timePerWord: 50,
    timePerCharacter: 15,
    highlightORP: true,
    letterSpacing: 3.5,
    punctuationDelay: 10,
    trailWordsCount: 5,
    chunkSize: 1,
    skillLevel: 1
  });

  const updateSetting = useCallback(<K extends keyof RSVPSettings>(key: K, value: RSVPSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return { settings, updateSetting };
};

export const useKeyboardEvents = (
  isDisplayingWords: boolean,
  onSpaceKey: () => void,
  onFocusedShortcut: (key: string) => void
) => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (isDisplayingWords) {
        switch (event.code) {
          case 'Space':
            event.preventDefault();
            onSpaceKey();
            break;
          case 'KeyJ':
            event.preventDefault();
            onFocusedShortcut('J');
            break;
          case 'KeyK':
            event.preventDefault();
            onFocusedShortcut('K');
            break;
          case 'KeyL':
            event.preventDefault();
            onFocusedShortcut('L');
            break;
        }
      }
    };

    if (isDisplayingWords) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isDisplayingWords, onSpaceKey, onFocusedShortcut]);
};

export const useReadingTimer = (
  state: RSVPState,
  settings: RSVPSettings,
  updateState: (updates: Partial<RSVPState>) => void,
  loadNextChunk?: () => void,
  loadMoreWords?: (currentIndex: number) => void
) => {
  useEffect(() => {
    if (!state.isPlaying || state.currentWordIndex >= state.words.length) {
      if (state.isPlaying && state.currentWordIndex >= state.words.length) {
        console.log('Playback finished for current chunk');

        // Try to load next chunk if available
        if (loadNextChunk) {
          loadNextChunk();
        } else {
          updateState({ isPlaying: false });
        }
      }
      return;
    }

    const currentWord = state.words[state.currentWordIndex];
    const delay = RSVPCalculationService.getDelay(currentWord, settings, state.currentWordIndex, state.words);

    const timer = setTimeout(() => {
      updateState({ currentWordIndex: state.currentWordIndex + 1 });

      // Load more words if approaching end
      if (loadMoreWords && state.currentWordIndex >= state.words.length - 100) {
        loadMoreWords(state.currentWordIndex + 1);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [state.isPlaying, state.currentWordIndex, state.words, settings.timePerWord, settings.timePerCharacter, updateState, loadNextChunk, loadMoreWords]);
};