'use client';

import { useState } from 'react';
import { useRSVP } from '../new-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Play, Pause, RotateCcw, Clipboard, ArrowRight } from 'lucide-react';

export function SimpleSettings() {
  const { state, settings, updateSetting, playPause, resetToStart, loadClipboard, jumpToWord } = useRSVP();
  const [jumpInput, setJumpInput] = useState('');

  const handleSliderChange = (key: keyof typeof settings, value: number[]) => {
    updateSetting(key, value[0]);
  };

  // Convert timePerWord to word delay in ms (since timePerWord is the delay)
  const wordDelayMs = Math.round(settings.timePerWord);
  const charDelayMs = Math.round(settings.timePerCharacter);
  const punctDelayMs = Math.round(settings.punctuationDelay);

  const handleJumpToWord = async () => {
    const wordIndex = parseInt(jumpInput) - 1; // Convert from 1-based to 0-based
    if (!isNaN(wordIndex) && wordIndex >= 0 && state.currentProject && wordIndex < state.currentProject.total_words) {
      try {
        await jumpToWord(wordIndex);
        setJumpInput(''); // Clear input after successful jump
      } catch (error) {
        console.error('Failed to jump to word:', error);
      }
    } else {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(`Please enter a valid word number between 1 and ${state.currentProject?.total_words?.toLocaleString() || 'N/A'}`, {
        title: 'Invalid Word Number',
        kind: 'warning'
      });
    }
  };

  const handleJumpInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJumpToWord();
    }
  };

  return (
    <div className="w-80 h-full bg-gray-900 border-l border-gray-700 flex flex-col overflow-y-auto text-white">
      <div className="p-4 space-y-4">
        {/* Current Session */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white font-mono">Current Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.currentProject ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-300 font-mono">
                  <div className="font-medium truncate">{state.currentProject.filename}</div>
                  <div>Progress: {state.globalWordIndex.toLocaleString()} / {state.currentProject.total_words.toLocaleString()}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 font-mono">
                No project loaded
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={playPause}
                disabled={!state.isDisplayingWords}
                className="flex-1"
              >
                {state.isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={resetToStart}
                disabled={!state.currentProject}
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={loadClipboard}
              className="w-full"
            >
              <Clipboard className="w-3 h-3 mr-2" />
              Read Clipboard
            </Button>

            {state.currentProject && (
              <div className="space-y-2">
                <Label className="text-xs text-gray-300 font-mono">Jump to Word</Label>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    placeholder="Word #"
                    value={jumpInput}
                    onChange={(e) => setJumpInput(e.target.value)}
                    onKeyPress={handleJumpInputKeyPress}
                    className="flex-1 bg-gray-700 border-gray-600 text-white text-xs"
                    min="1"
                    max={state.currentProject.total_words}
                  />
                  <Button
                    size="sm"
                    onClick={handleJumpToWord}
                    disabled={!jumpInput.trim()}
                  >
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  Current: {(state.globalWordIndex + 1).toLocaleString()} / {state.currentProject.total_words.toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timing Settings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white font-mono">Timing Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-gray-300 font-mono">Word Delay</Label>
                <span className="text-xs text-gray-400 font-mono">{wordDelayMs}ms</span>
              </div>
              <Slider
                value={[settings.timePerWord]}
                onValueChange={(value) => handleSliderChange('timePerWord', value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-gray-300 font-mono">Character Delay</Label>
                <span className="text-xs text-gray-400 font-mono">{charDelayMs}ms</span>
              </div>
              <Slider
                value={[settings.timePerCharacter]}
                onValueChange={(value) => handleSliderChange('timePerCharacter', value)}
                min={0}
                max={50}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-gray-300 font-mono">Punctuation Delay</Label>
                <span className="text-xs text-gray-400 font-mono">{punctDelayMs}ms</span>
              </div>
              <Slider
                value={[settings.punctuationDelay]}
                onValueChange={(value) => handleSliderChange('punctuationDelay', value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-gray-300 font-mono">Letter Spacing</Label>
                <span className="text-xs text-gray-400 font-mono">{settings.letterSpacing}</span>
              </div>
              <Slider
                value={[settings.letterSpacing]}
                onValueChange={(value) => handleSliderChange('letterSpacing', value)}
                min={0}
                max={10}
                step={0.5}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-gray-300 font-mono">Trail Words</Label>
                <span className="text-xs text-gray-400 font-mono">{settings.trailWordsCount}</span>
              </div>
              <Slider
                value={[settings.trailWordsCount]}
                onValueChange={(value) => handleSliderChange('trailWordsCount', value)}
                min={0}
                max={15}
                step={1}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-300 font-mono">Highlight ORP</Label>
              <Switch
                checked={settings.highlightORP}
                onCheckedChange={(checked) => updateSetting('highlightORP', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-300 font-mono">Normalize Text</Label>
              <Switch
                checked={settings.normalizeText}
                onCheckedChange={(checked) => updateSetting('normalizeText', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white font-mono">Shortcuts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-gray-300 font-mono">
              <div className="flex justify-between">
                <span>Play/Pause</span>
                <span className="font-mono text-gray-400">Space</span>
              </div>
              <div className="flex justify-between">
                <span>Previous Word</span>
                <span className="font-mono text-gray-400">←</span>
              </div>
              <div className="flex justify-between">
                <span>Next Word</span>
                <span className="font-mono text-gray-400">→</span>
              </div>
              <div className="flex justify-between">
                <span>Reset</span>
                <span className="font-mono text-gray-400">⌘R</span>
              </div>
              <div className="flex justify-between">
                <span>Toggle App</span>
                <span className="font-mono text-gray-400">⌥C</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}