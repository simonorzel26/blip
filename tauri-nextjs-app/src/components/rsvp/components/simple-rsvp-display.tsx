'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRSVP } from '../new-context';

export function SimpleRSVPDisplay() {
  const { state, settings, playPause, resetToStart, nextWord, previousWord } = useRSVP();
  const [fontSize, setFontSize] = useState(48);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          playPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousWord();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextWord();
          break;
        case 'KeyR':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            resetToStart();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [playPause, previousWord, nextWord, resetToStart]);

  // Calculate dynamic font size based on word length and max word length
  useEffect(() => {
    if (state.maxWordLength > 0) {
      const baseFontSize = 72;
      const scaleFactor = Math.max(0.4, Math.min(1.2, 24 / state.maxWordLength));
      setFontSize(baseFontSize * scaleFactor);
    }
  }, [state.maxWordLength]);

  // Text normalization function
  const normalizeText = (text: string): string => {
    if (!settings.normalizeText) return text;
    return text.toLowerCase().replace(/\s+/g, '');
  };

  const currentWord = normalizeText(state.words[state.currentWordIndex] || '');

  // Calculate progress
  const progress = state.currentProject
    ? {
        current: state.globalWordIndex,
        total: state.currentProject.total_words,
        percentage: Math.round((state.globalWordIndex / state.currentProject.total_words) * 100)
      }
    : {
        current: state.currentWordIndex,
        total: state.words.length,
        percentage: state.words.length > 0 ? Math.round((state.currentWordIndex / state.words.length) * 100) : 0
      };

  // Calculate ORP (Optimal Recognition Point) - approximately 1/3 through the word
  const orpIndex = useMemo(() => {
    if (currentWord.length === 0) return -1;
    if (currentWord.length === 1) return 0;
    if (currentWord.length === 2) return 0;
    return Math.floor(currentWord.length / 3);
  }, [currentWord]);

  // Split word into parts for ORP highlighting
  const wordParts = useMemo(() => {
    if (currentWord.length === 0 || orpIndex === -1) {
      return { before: '', orp: '', after: currentWord };
    }

    return {
      before: currentWord.substring(0, orpIndex),
      orp: currentWord.charAt(orpIndex),
      after: currentWord.substring(orpIndex + 1)
    };
  }, [currentWord, orpIndex]);

  if (!state.isDisplayingWords) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900/80 via-slate-900/80 to-gray-800/80 backdrop-blur-sm border-x border-gray-700/50">
        <div className="text-center text-gray-400">
          <p className="text-lg mb-2 font-mono">
            No content loaded
          </p>
          <p className="text-sm font-mono opacity-70">
            Import a file or use the clipboard shortcut (Option+C)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative bg-gradient-to-br from-gray-900/80 via-slate-900/80 to-gray-800/80 backdrop-blur-sm border-x border-gray-700/50 text-gray-100 font-mono">
            {/* Main reading area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {/* Letter grid container */}
          <div
            className="inline-flex items-center justify-center"
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              minHeight: `${fontSize * 1.2}px`,
            }}
          >
            {/* Create a grid of letter positions based on max word length */}
            {Array.from({ length: Math.max(state.maxWordLength, 15) }, (_, index) => {
              const orpPosition = Math.floor(Math.max(state.maxWordLength, 15) / 2); // Center position
              const letterPosition = index - orpPosition + orpIndex; // Position relative to ORP
              const letter = letterPosition >= 0 && letterPosition < currentWord.length
                ? currentWord[letterPosition]
                : '';

              const isORP = letterPosition === orpIndex && settings.highlightORP && letter;

              return (
                <div
                  key={index}
                  className="font-bold leading-none select-none flex items-center justify-center"
                  style={{
                    width: `${fontSize * 0.6}px`,
                    height: `${fontSize * 1.2}px`,
                    marginLeft: index === 0 ? '0' : `${settings.letterSpacing}px`,
                    color: isORP ? '#ef4444' : '#f1f5f9',
                    fontWeight: isORP ? 'bold' : 'normal',
                    textShadow: isORP ? '0 0 8px rgba(239, 68, 68, 0.3)' : '0 0 4px rgba(241, 245, 249, 0.1)'
                  }}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom right word counter - matte style */}
      <div className="absolute bottom-4 right-4">
        <div className="text-right text-sm space-y-1 text-gray-400 bg-gray-900/40 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-700/30">
          <div>
            {(progress.current + 1).toLocaleString()} / {progress.total.toLocaleString()}
          </div>
          <div className="text-xs">
            {progress.percentage}%
          </div>
          {state.currentProject && (
            <div className="text-xs opacity-75 max-w-48 truncate">
              {state.currentProject.filename}
            </div>
          )}
        </div>
      </div>

            {/* Trail words - positioned above main word */}
      {settings.trailWordsCount > 0 && (
        <div className="absolute inset-x-0 flex justify-center" style={{ bottom: '60%' }}>
          <div className="flex flex-col-reverse space-y-reverse space-y-2 text-gray-500 font-mono text-center">
            {Array.from({ length: settings.trailWordsCount }, (_, i) => {
              // Show words starting from current word and going backwards
              const wordIndex = state.currentWordIndex - i;
              const rawWord = wordIndex >= 0 ? state.words[wordIndex] : '';
              const word = normalizeText(rawWord);
              const opacity = word ? (settings.trailWordsCount - i) / settings.trailWordsCount * 0.8 : 0;

              return (
                <div
                  key={i}
                  style={{
                    opacity,
                    fontSize: `${fontSize * 0.25}px`,
                    letterSpacing: `${settings.letterSpacing * 0.3}px`,
                    marginBottom: '4px'
                  }}
                >
                  {word}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden controls for keyboard shortcuts only */}
      <div className="sr-only">
        <button onClick={resetToStart} title="Reset to start (Cmd/Ctrl+R)" />
        <button onClick={previousWord} title="Previous word (←)" />
        <button onClick={playPause} title="Play/Pause (Space)" />
        <button onClick={nextWord} title="Next word (→)" />
      </div>
    </div>
  );
}