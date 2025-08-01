"use client";

import { useState } from "react";
import { Settings, Play, Pause, RotateCcw, Eye, EyeOff, Gauge, Timer, Type, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useRSVP } from "../context";
import { RSVPCalculationService } from "../services";

export const SettingsSidebar = () => {
  const { state, settings, updateState, updateSettings } = useRSVP();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const effectiveWPM = RSVPCalculationService.getEffectiveWPM(state.words, settings);

  const handleSettingChange = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    updateSettings(key, value);
  };

  if (isCollapsed) {
    return (
      <div className="fixed left-0 top-8 h-full w-16 bg-black/30 backdrop-blur-xl border-r border-white/20 flex flex-col items-center py-4 z-30">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="text-white hover:bg-white/10 bg-black/20 backdrop-blur-sm border border-white/10"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed left-0 top-8 h-full w-80 bg-black/30 backdrop-blur-xl border-r border-white/20 overflow-y-auto z-30">
      {/* Background Blur Layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-purple-900/10 to-pink-900/10" />

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/5 rounded-full blur-2xl animate-pulse delay-1000" />
      </div>

      <div className="relative p-6 z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Reading Settings</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            className="text-white hover:bg-white/10 bg-black/20 backdrop-blur-sm border border-white/10"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Speed Settings */}
          <Card className="bg-black/20 backdrop-blur-xl border-white/20 shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Speed Control
              </CardTitle>
              <CardDescription className="text-white/70">
                Adjust reading speed and timing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm">Time per word (ms)</Label>
                  <Badge variant="secondary" className="text-xs bg-white/10 border-white/20">
                    {settings.timePerWord}ms
                  </Badge>
                </div>
                <Slider
                  value={[settings.timePerWord]}
                  onValueChange={(value) => handleSettingChange('timePerWord', value[0])}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm">Time per character (ms)</Label>
                  <Badge variant="secondary" className="text-xs bg-white/10 border-white/20">
                    {settings.timePerCharacter}ms
                  </Badge>
                </div>
                <Slider
                  value={[settings.timePerCharacter]}
                  onValueChange={(value) => handleSettingChange('timePerCharacter', value[0])}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm">Punctuation delay (ms)</Label>
                  <Badge variant="secondary" className="text-xs bg-white/10 border-white/20">
                    {settings.punctuationDelay}ms
                  </Badge>
                </div>
                <Slider
                  value={[settings.punctuationDelay]}
                  onValueChange={(value) => handleSettingChange('punctuationDelay', value[0])}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card className="bg-black/20 backdrop-blur-xl border-white/20 shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Type className="h-4 w-4" />
                Display Options
              </CardTitle>
              <CardDescription className="text-white/70">
                Customize how words are displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-white text-sm">Highlight ORP</Label>
                <Switch
                  checked={settings.highlightORP}
                  onCheckedChange={(checked) => handleSettingChange('highlightORP', checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm">Letter spacing (rem)</Label>
                  <Badge variant="secondary" className="text-xs bg-white/10 border-white/20">
                    {settings.letterSpacing}rem
                  </Badge>
                </div>
                <Slider
                  value={[settings.letterSpacing]}
                  onValueChange={(value) => handleSettingChange('letterSpacing', value[0])}
                  max={4}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white text-sm">Trail words count</Label>
                  <Badge variant="secondary" className="text-xs bg-white/10 border-white/20">
                    {settings.trailWordsCount}
                  </Badge>
                </div>
                <Slider
                  value={[settings.trailWordsCount]}
                  onValueChange={(value) => handleSettingChange('trailWordsCount', value[0])}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="bg-black/20 backdrop-blur-xl border-white/20 shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Reading Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Effective Speed</span>
                <Badge variant="outline" className="text-white border-white/20 bg-white/10">
                  ~{effectiveWPM} WPM
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Words Loaded</span>
                <Badge variant="outline" className="text-white border-white/20 bg-white/10">
                  {state.words.length}
                </Badge>
              </div>
              {state.isDisplayingWords && (
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-sm">Current Position</span>
                  <Badge variant="outline" className="text-white border-white/20 bg-white/10">
                    {state.currentWordIndex + 1} / {state.words.length}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <Card className="bg-black/20 backdrop-blur-xl border-white/20 shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Play className="h-4 w-4" />
                Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white border-white/20 hover:bg-white/10 bg-black/20 backdrop-blur-sm"
                  onClick={() => {
                    if (state.currentWordIndex >= state.words.length) {
                      updateState({ currentWordIndex: 0, isPlaying: true });
                    } else if (state.isPlaying) {
                      updateState({ isPlaying: false });
                    } else {
                      updateState({ isPlaying: true });
                    }
                  }}
                >
                  {state.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {state.isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white border-white/20 hover:bg-white/10 bg-black/20 backdrop-blur-sm"
                  onClick={() => updateState({ currentWordIndex: 0, isPlaying: false })}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card className="bg-black/20 backdrop-blur-xl border-white/20 shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">Keyboard Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-white/70">
              <div className="flex justify-between">
                <span>Space / K</span>
                <span>Play/Pause</span>
              </div>
              <div className="flex justify-between">
                <span>J</span>
                <span>Back 10 words</span>
              </div>
              <div className="flex justify-between">
                <span>L</span>
                <span>Forward 10 words</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};