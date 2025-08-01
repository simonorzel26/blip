import { invoke } from "@tauri-apps/api/core";
import { TrailWords } from "./trail-words";
import { CurrentWord } from "./current-word";
import { SettingsSidebar } from "./settings-sidebar";
import { FileExplorer } from "./file-explorer";
import { useRSVP } from "../context";
import { RSVPCalculationService } from "../services";

export const RSVPDisplay = () => {
  const { state, settings } = useRSVP();
  const effectiveWPM = RSVPCalculationService.getEffectiveWPM(state.words, settings, state.currentWordIndex);

  // Calculate global progress
  const getGlobalProgress = () => {
    try {
      const projectId = localStorage.getItem('current-project-id');
      if (projectId && state.isDisplayingWords) {
        const totalWords = parseInt(localStorage.getItem('current-project-total-words') || '0');

        // currentWordIndex represents the global position
        const globalWordPosition = state.currentWordIndex;
        const percentage = totalWords > 0 ? Math.round((globalWordPosition / totalWords) * 100) : 0;

        return {
          current: globalWordPosition,
          total: totalWords,
          percentage,
          chunkProgress: `${state.currentWordIndex + 1} / ${state.words.length}`
        };
      }
    } catch (error) {
      console.error('Failed to calculate global progress:', error);
    }

    return {
      current: state.currentWordIndex,
      total: state.words.length,
      percentage: state.words.length > 0 ? Math.round((state.currentWordIndex / state.words.length) * 100) : 0,
      chunkProgress: `${state.currentWordIndex + 1} / ${state.words.length}`
    };
  };

  const progress = getGlobalProgress();

  return (
    <div className="flex justify-center items-center h-screen w-full absolute inset-0 overflow-hidden">
      <div className="flex flex-col items-center justify-center w-full max-w-full ml-80 z-10">
        {state.currentWordIndex < state.words.length ? (
          <div className="text-4xl md:text-6xl bg-black/40 backdrop-blur-xl lg:text-8xl font-bold rounded-2xl px-4 md:px-8 py-4 md:py-6 max-w-[90vw] border border-white/10 shadow-2xl">
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

              <TrailWords
                currentIndex={state.currentWordIndex}
                words={state.words}
                trailWordsCount={settings.trailWordsCount}
              />
              <CurrentWord
                word={state.words[state.currentWordIndex]}
                highlightORP={settings.highlightORP}
                letterSpacing={settings.letterSpacing}
              />

              {/* WPM indicator */}
              <div className="absolute bottom-2 right-2 text-sm opacity-50">
                {effectiveWPM} WPM
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center max-w-[90vw] px-4">
            <div className="text-xl md:text-2xl mb-4 bg-black/40 backdrop-blur-xl rounded-lg px-6 py-4 border border-white/10">
              Reading complete!
            </div>
          </div>
        )}
      </div>

      {/* Settings Sidebar */}
      <SettingsSidebar />

      {/* File Explorer */}
      <FileExplorer />

      {/* Enhanced Progress Indicator */}
      {state.isDisplayingWords && (
        <div className="absolute bottom-4 right-4 text-white/70 bg-black/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10 z-20 min-w-[200px]">
          <div className="text-sm font-medium mb-1">
            {progress.current.toLocaleString()} / {progress.total.toLocaleString()} words
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mb-1">
            <div
              className="bg-white/30 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="text-xs opacity-70">
            {progress.percentage}% complete • {progress.chunkProgress} in chunk
          </div>
        </div>
      )}
    </div>
  );
};