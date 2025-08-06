'use client';

import { useRSVP } from '../new-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Play, Pause, RotateCcw, Clipboard } from 'lucide-react';

export function SimpleSettings() {
  const { state, settings, updateSetting, playPause, resetToStart, loadClipboard } = useRSVP();

  const handleSliderChange = (key: keyof typeof settings, value: number[]) => {
    updateSetting(key, value[0]);
  };

  // Convert timePerWord to word delay in ms (since timePerWord is the delay)
  const wordDelayMs = Math.round(settings.timePerWord);
  const charDelayMs = Math.round(settings.timePerCharacter);
  const punctDelayMs = Math.round(settings.punctuationDelay);

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

            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-300 font-mono">Highlight ORP</Label>
              <Switch
                checked={settings.highlightORP}
                onCheckedChange={(checked) => updateSetting('highlightORP', checked)}
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