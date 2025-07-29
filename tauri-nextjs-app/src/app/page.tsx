"use client";

import { useState, useEffect } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Types and interfaces
interface RSVPState {
  words: string[];
  currentWordIndex: number;
  maxWordLength: number;
  clipboardHash: string;
  isDisplayingWords: boolean;
  isPlaying: boolean;
}

interface RSVPSettings {
  timePerWord: number;
  timePerCharacter: number;
  highlightORP: boolean;
  chunkSize: number;
  skillLevel: number;
}

interface RSVPContextValue {
  state: RSVPState;
  settings: RSVPSettings;
  updateState: (updates: Partial<RSVPState>) => void;
  updateSettings: <K extends keyof RSVPSettings>(key: K, value: RSVPSettings[K]) => void;
}

// Utility functions
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

// Clipboard service
class ClipboardService {
  static async readContent(): Promise<string | null> {
    try {
      const text = await readText();
      return text && text.trim() ? text : null;
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      return null;
    }
  }
}

// State persistence service
class StatePersistenceService {
  private static readonly STORAGE_KEY = 'rsvp-state';

  static save(state: RSVPState, settings: RSVPSettings): void {
    if (state.isDisplayingWords && state.words.length > 0) {
      const stateToSave = { ...state, ...settings };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }

  static load(): { state: Partial<RSVPState>; settings: Partial<RSVPSettings> } | null {
    const savedState = localStorage.getItem(this.STORAGE_KEY);
    if (!savedState) return null;

    try {
      const parsed = JSON.parse(savedState);
      if (parsed.words && parsed.currentWordIndex !== undefined) {
        return {
          state: {
            words: parsed.words,
            currentWordIndex: parsed.currentWordIndex,
            maxWordLength: parsed.maxWordLength || 0,
            clipboardHash: parsed.clipboardHash || '',
            isDisplayingWords: true,
            isPlaying: false
          },
          settings: {
            timePerWord: parsed.timePerWord || 50,
            timePerCharacter: parsed.timePerCharacter || 15,
            highlightORP: parsed.highlightORP !== undefined ? parsed.highlightORP : true,
            chunkSize: parsed.chunkSize || 1,
            skillLevel: parsed.skillLevel || 1
          }
        };
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error);
    }
    return null;
  }

  static clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

// RSVP calculation service
class RSVPCalculationService {
  static getDelay(word: string, settings: RSVPSettings): number {
    return settings.timePerWord + (word.length * settings.timePerCharacter);
  }

  static getEffectiveWPM(words: string[], settings: RSVPSettings): number {
    if (words.length === 0) return 0;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const avgTimePerWord = settings.timePerWord + (avgWordLength * settings.timePerCharacter);
    return Math.round((60 * 1000) / avgTimePerWord);
  }

  static getORPIndex(word: string): number {
    return Math.floor(word.length / 3);
  }

  static getTrailWords(currentIndex: number, words: string[]): string[] {
    if (currentIndex === 0) return ['', '', ''];
    if (currentIndex === 1) return ['', '', words[0]];
    if (currentIndex === 2) return ['', words[0], words[1]];

    const startIndex = currentIndex - 3;
    const trailWords = words.slice(startIndex, currentIndex);
    return trailWords.reverse();
  }

  static processText(text: string): { words: string[]; maxLength: number } {
    const wordArray = text.split(/\s+/).filter(word => word.length > 0);
    const truncatedWords = wordArray.map(word => word.length > 20 ? word.substring(0, 20) : word);
    const maxLength = Math.max(...truncatedWords.map(word => word.length));
    return { words: truncatedWords, maxLength };
  }
}

// Tauri event hook
const useTauriEvents = () => {
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

// RSVP state management hook
const useRSVPState = () => {
  const [state, setState] = useState<RSVPState>({
    words: [],
    currentWordIndex: 0,
    maxWordLength: 0,
    clipboardHash: '',
    isDisplayingWords: false,
    isPlaying: false
  });

  const updateState = (updates: Partial<RSVPState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  return { state, updateState };
};

// Settings management hook
const useSettings = () => {
  const [settings, setSettings] = useState<RSVPSettings>({
    timePerWord: 50,
    timePerCharacter: 15,
    highlightORP: true,
    chunkSize: 1,
    skillLevel: 1
  });

  const updateSetting = <K extends keyof RSVPSettings>(key: K, value: RSVPSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return { settings, updateSetting };
};

// Keyboard event hook
const useKeyboardEvents = (isDisplayingWords: boolean, onSpaceKey: () => void) => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' && isDisplayingWords) {
        event.preventDefault();
        onSpaceKey();
      }
    };

    if (isDisplayingWords) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isDisplayingWords, onSpaceKey]);
};

// Reading timer hook
const useReadingTimer = (state: RSVPState, settings: RSVPSettings, updateState: (updates: Partial<RSVPState>) => void) => {
  useEffect(() => {
    if (!state.isPlaying || state.currentWordIndex >= state.words.length) {
      if (state.isPlaying && state.currentWordIndex >= state.words.length) {
        console.log('Playback finished');
        updateState({ isPlaying: false });
      }
      return;
    }

    const currentWord = state.words[state.currentWordIndex];
    const delay = RSVPCalculationService.getDelay(currentWord, settings);

    const timer = setTimeout(() => {
      updateState({ currentWordIndex: state.currentWordIndex + 1 });
    }, delay);

    return () => clearTimeout(timer);
  }, [state.isPlaying, state.currentWordIndex, state.words, settings.timePerWord, settings.timePerCharacter, updateState]);
};

// Main RSVP controller hook
const useRSVPController = () => {
  const { state, updateState } = useRSVPState();
  const { settings, updateSetting } = useSettings();
  const { isWindowVisible } = useTauriEvents();

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

  const handleHide = async () => {
    await invoke('hide_window');
    updateState({ isDisplayingWords: false, words: [] });
    StatePersistenceService.clear();
  };

  // Setup keyboard events
  useKeyboardEvents(state.isDisplayingWords, handleSpaceKey);

  // Setup reading timer
  useReadingTimer(state, settings, updateState);

  return {
    state,
    settings,
    updateSetting,
    displayWords,
    handleHide
  };
};

// UI Components
const TrailWords = ({ currentIndex, words }: { currentIndex: number; words: string[] }) => {
  const trailWords = RSVPCalculationService.getTrailWords(currentIndex, words);

  return (
    <div className="absolute top-32 left-0 right-0 flex flex-col items-center space-y-4 w-full">
      {trailWords.map((word, index) => {
        const Component = index === 0 ? 'h1' : index === 1 ? 'h2' : 'h3';
        return (
          <Component
            key={index}
            className="font-mono text-gray-400 m-0"
            style={{
              fontSize: index === 0 ? '2.5rem' : index === 1 ? '1.75rem' : '1.25rem',
              opacity: index === 0 ? 0.7 : index === 1 ? 0.5 : 0.3
            }}
          >
            {word}
          </Component>
        );
      })}
    </div>
  );
};

const CurrentWord = ({ word, highlightORP }: { word: string; highlightORP: boolean }) => {
  const orpIndex = RSVPCalculationService.getORPIndex(word);

  return (
    <div className="absolute inset-0 flex items-center">
      <div className="font-mono text-left">
        {word.split('').map((char, charIndex) => (
          <span
            key={charIndex}
            className={highlightORP && charIndex === orpIndex ? 'text-red-500' : ''}
          >
            {char}
          </span>
        ))}
      </div>
    </div>
  );
};

const SettingsSidebar = ({
  settings,
  updateSetting,
  words
}: {
  settings: RSVPSettings;
  updateSetting: <K extends keyof RSVPSettings>(key: K, value: RSVPSettings[K]) => void;
  words: string[];
}) => {
  const effectiveWPM = RSVPCalculationService.getEffectiveWPM(words, settings);

  return (
    <div className="absolute right-4 top-4 w-80 bg-black/20 backdrop-blur-lg rounded-lg p-6 text-white">
      <h3 className="text-lg font-semibold mb-4">Settings</h3>

      <div className="space-y-4 mb-6">
        <div className="flex flex-col space-y-2">
          <label className="text-sm text-gray-300">Time per word (ms)</label>
          <input
            type="number"
            min="50"
            max="2000"
            step="10"
            value={settings.timePerWord}
            onChange={(e) => updateSetting('timePerWord', Number(e.target.value))}
            className="w-full h-8 rounded px-2 text-center text-white bg-black/30"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-sm text-gray-300">Time per character (ms)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            value={settings.timePerCharacter}
            onChange={(e) => updateSetting('timePerCharacter', Number(e.target.value))}
            className="w-full h-8 rounded px-2 text-center text-white bg-black/30"
          />
        </div>

        <div className="text-xs text-gray-400">
          Effective speed: ~{effectiveWPM} WPM
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-4">
        <input
          type="checkbox"
          id="highlightORP"
          checked={settings.highlightORP}
          onChange={(e) => updateSetting('highlightORP', e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="highlightORP" className="text-sm text-gray-300">
          Highlight Optimal Recognition Point (ORP)
        </label>
      </div>

      <div className="text-sm text-gray-400">
        Press <code className="px-2 py-1 rounded bg-white/20">Space</code> to resume reading
      </div>
    </div>
  );
};

const RSVPDisplay = ({
  state,
  settings,
  updateSetting
}: {
  state: RSVPState;
  settings: RSVPSettings;
  updateSetting: <K extends keyof RSVPSettings>(key: K, value: RSVPSettings[K]) => void;
}) => {
  const effectiveWPM = RSVPCalculationService.getEffectiveWPM(state.words, settings);

  return (
    <div className="flex justify-center items-center h-screen w-full absolute inset-0 overflow-hidden">
      <div className="flex flex-col items-center justify-center w-full max-w-full">
        {state.currentWordIndex < state.words.length ? (
          <div className="text-4xl md:text-6xl bg-[#2e2e2e] lg:text-8xl font-bold rounded-2xl px-4 md:px-8 py-4 md:py-6 max-w-[90vw]">
            <div
              className="font-mono relative"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
              }}
            >
              {/* Invisible longest word to preserve space */}
              <div className="opacity-0 text-left">
                {state.words.reduce((longest, current) =>
                  current.length > longest.length ? current : longest, ''
                )}
              </div>

              <TrailWords currentIndex={state.currentWordIndex} words={state.words} />
              <CurrentWord word={state.words[state.currentWordIndex]} highlightORP={settings.highlightORP} />

              {/* WPM indicator */}
              <div className="absolute bottom-2 right-2 text-sm opacity-50">
                {effectiveWPM} WPM
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center max-w-[90vw] px-4">
            <div className="text-xl md:text-2xl mb-4">Reading complete!</div>
          </div>
        )}
      </div>

      {/* Settings Sidebar - only show when paused */}
      {!state.isPlaying && state.isDisplayingWords && (
        <SettingsSidebar settings={settings} updateSetting={updateSetting} words={state.words} />
      )}

      <button
        onClick={async () => {
          await invoke('hide_window');
        }}
        className="absolute top-4 left-4 text-white px-4 py-2 rounded-lg transition-colors"
      >
        Hide
      </button>

      {state.isPlaying && (
        <div className="absolute bottom-4 left-4 text-white/70">
          Word {state.currentWordIndex + 1} of {state.words.length}
        </div>
      )}
    </div>
  );
};

const WelcomeScreen = ({ onTestClick }: { onTestClick: () => void }) => (
  <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
    <h1 className="text-2xl font-bold text-center">
      Tauri + Next.js Word Display
    </h1>
    <p className="text-center text-sm">
      Press <code className="font-mono font-semibold px-1 py-0.5 rounded">
        Option+C
      </code> to toggle the app and display clipboard words
    </p>
    <button
      onClick={onTestClick}
      className="text-white px-4 py-2 rounded-lg transition-colors"
    >
      Toggle Window & Test Clipboard
    </button>
  </main>
);

export default function Home() {
  const { state, settings, updateSetting, displayWords, handleHide } = useRSVPController();

  const handleTestClick = async () => {
    console.log('Test button clicked');
    try {
      const isVisible = await invoke('toggle_window');
      console.log('Test window visibility:', isVisible);

      if (isVisible) {
        try {
          const text = await ClipboardService.readContent();
          console.log('Test clipboard content:', text);
          if (text) {
            displayWords(text, hashString(text));
          }
        } catch (error) {
          console.error('Test clipboard failed:', error);
        }
      }
    } catch (error) {
      console.error('Test toggle failed:', error);
    }
  };

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 bg-black/[.02]" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}>
      {state.isDisplayingWords ? (
        <RSVPDisplay state={state} settings={settings} updateSetting={updateSetting} />
      ) : (
        <WelcomeScreen onTestClick={handleTestClick} />
      )}
    </div>
  );
}
