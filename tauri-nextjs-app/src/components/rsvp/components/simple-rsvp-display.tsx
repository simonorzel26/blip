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

  const currentWord = state.words[state.currentWordIndex] || '';

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
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#000000' }}>
        <div className="text-center" style={{ color: '#888888' }}>
          <p className="text-lg mb-2" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}>
            No content loaded
          </p>
          <p className="text-sm" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}>
            Import a file or use the clipboard shortcut (Option+C)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col relative"
      style={{
        backgroundColor: '#000000',
        color: '#ffffff',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
      }}
    >
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
                    color: isORP ? '#ff4444' : '#ffffff',
                    fontWeight: isORP ? 'bold' : 'normal',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                  }}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom right word counter - original style */}
      <div className="absolute bottom-4 right-4">
        <div
          className="text-right text-sm space-y-1"
          style={{
            color: '#888888',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
          }}
        >
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

            {/* Trail words - positioned below main word */}
      {settings.trailWordsCount > 0 && (
        <div className="absolute inset-x-0" style={{ top: '60%' }}>
          <div
            className="text-center space-y-2"
            style={{
              color: '#555555',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
            }}
          >
            {Array.from({ length: settings.trailWordsCount }, (_, i) => {
              // Show previous words in descending order (most recent first)
              const wordIndex = state.currentWordIndex - 1 - i;
              const word = wordIndex >= 0 ? state.words[wordIndex] : '';
              const opacity = word ? (settings.trailWordsCount - i) / settings.trailWordsCount * 0.6 : 0;

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