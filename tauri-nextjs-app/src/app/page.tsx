"use client";

import { useState, useEffect } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export default function Home() {
  const [words, setWords] = useState<string[]>([]);
  const [isDisplayingWords, setIsDisplayingWords] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [maxWordLength, setMaxWordLength] = useState(0);

  useEffect(() => {
    // Listen for window visibility changes from Rust
    const setupListener = async () => {
      const unlisten = await listen('window-toggled', (event: { payload: { isVisible: boolean } }) => {
        const { isVisible } = event.payload;
        if (isVisible) {
          // Window is now visible, try to read clipboard
          readText().then((text) => {
            if (text && text.trim()) {
              displayWords(text);
            }
          }).catch((error) => {
            console.error('Failed to read clipboard:', error);
          });
        } else {
          // Window is now hidden
          setIsDisplayingWords(false);
          setWords([]);
          setIsPlaying(false);
          setCurrentWordIndex(0);
          setMaxWordLength(0);
        }
      });

      return unlisten;
    };

    setupListener();
  }, []);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      console.log('Key pressed:', event.code, 'isDisplayingWords:', isDisplayingWords, 'isPlaying:', isPlaying);
      if (event.code === 'Space' && isDisplayingWords) {
        event.preventDefault();
        console.log('Spacebar pressed - toggling playback');
        if (isPlaying) {
          stopPlayback();
        } else {
          startPlayback();
        }
      }
    };

    // Only add listener when window is visible and has words
    if (isDisplayingWords) {
      console.log('Adding spacebar listener');
      document.addEventListener('keydown', handleKeyPress);
      return () => {
        console.log('Removing spacebar listener');
        document.removeEventListener('keydown', handleKeyPress);
      };
    }
  }, [isPlaying, isDisplayingWords]);

  const startPlayback = () => {
    if (words.length === 0) return;
    console.log('Starting playback with', words.length, 'words');
    setIsPlaying(true);
    setCurrentWordIndex(0);
  };

  const stopPlayback = () => {
    console.log('Stopping playback');
    setIsPlaying(false);
  };

    useEffect(() => {
    if (!isPlaying || currentWordIndex >= words.length) {
      if (isPlaying && currentWordIndex >= words.length) {
        console.log('Playback finished - hiding window');
        setIsPlaying(false);
        // Automatically hide the window when playback finishes
        invoke('hide_window').catch((error) => {
          console.error('Failed to hide window:', error);
        });
      }
      return;
    }

    const currentWord = words[currentWordIndex];
    const delay = (currentWord.length * 25); // 100ms + 10ms per letter

    console.log(`Showing word ${currentWordIndex + 1}/${words.length}: "${currentWord}" for ${delay}ms`);

    const timer = setTimeout(() => {
      setCurrentWordIndex(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [isPlaying, currentWordIndex, words]);

  const displayWords = (text: string) => {
    const wordArray = text.split(/\s+/).filter(word => word.length > 0);
    const maxLength = Math.max(...wordArray.map(word => word.length));
    console.log('Displaying words:', wordArray, 'max length:', maxLength);
    setWords(wordArray);
    setMaxWordLength(maxLength);
    setIsDisplayingWords(true);
  };

  const handleHide = async () => {
    await invoke('hide_window');
    setIsDisplayingWords(false);
    setWords([]);
  };

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}>
      {isDisplayingWords ? (
        <div className="flex justify-center items-center h-screen w-full bg-black text-white absolute inset-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center w-full max-w-full">
                                                                                    {isPlaying && currentWordIndex < words.length ? (
              <div className="text-4xl md:text-6xl lg:text-8xl font-bold bg-white/10 backdrop-blur-lg rounded-2xl px-4 md:px-8 py-4 md:py-6 max-w-[90vw] overflow-hidden">
                <div
                  className="font-mono relative"
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                  }}
                >
                  {/* Invisible longest word to preserve space */}
                  <div className="opacity-0 text-left">
                    {words.reduce((longest, current) =>
                      current.length > longest.length ? current : longest, ''
                    )}
                  </div>
                  {/* Actual word positioned absolutely at the same left start point */}
                  <div className="absolute inset-0 flex items-center">
                    <div className="font-mono text-left">
                      {words[currentWordIndex]}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center max-w-[90vw] px-4">
                <div className="text-xl md:text-2xl mb-4">Words loaded: {words.length}</div>
                <div className="text-base md:text-lg text-gray-300 mb-4">
                  Press <code className="bg-white/20 px-2 py-1 rounded">Space</code> to start/stop playback
                </div>
                {maxWordLength > 0 && (
                  <div className="text-xs md:text-sm text-gray-400">
                    Max word length: {maxWordLength} characters
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleHide}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg backdrop-blur-lg transition-colors"
          >
            Hide
          </button>
          {isPlaying && (
            <div className="absolute bottom-4 left-4 text-white/70">
              Word {currentWordIndex + 1} of {words.length}
            </div>
          )}
        </div>
      ) : (
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
          <h1 className="text-2xl font-bold text-center">
            Tauri + Next.js Word Display
          </h1>
          <p className="text-center text-sm">
            Press <code className="bg-black/[.05] dark:bg-white/[.06] font-mono font-semibold px-1 py-0.5 rounded">
              Option+C
            </code> to toggle the app and display clipboard words
          </p>
          <button
            onClick={async () => {
              console.log('Test button clicked');
              try {
                const isVisible = await invoke('toggle_window');
                console.log('Test window visibility:', isVisible);

                if (isVisible) {
                  try {
                    const text = await readText();
                    console.log('Test clipboard content:', text);
                    if (text && text.trim()) {
                      displayWords(text);
                    }
                  } catch (error) {
                    console.error('Test clipboard failed:', error);
                  }
                } else {
                  setIsDisplayingWords(false);
                  setWords([]);
                }
              } catch (error) {
                console.error('Test toggle failed:', error);
              }
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Toggle Window & Test Clipboard
          </button>
        </main>
      )}
    </div>
  );
}
