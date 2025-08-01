export interface RSVPState {
  words: string[];
  currentWordIndex: number;
  maxWordLength: number;
  clipboardHash: string;
  isDisplayingWords: boolean;
  isPlaying: boolean;
}

export interface RSVPSettings {
  timePerWord: number;
  timePerCharacter: number;
  highlightORP: boolean;
  letterSpacing: number;
  punctuationDelay: number;
  trailWordsCount: number;
  chunkSize: number;
  skillLevel: number;
}

export interface RSVPContextValue {
  state: RSVPState;
  settings: RSVPSettings;
  updateState: (updates: Partial<RSVPState>) => void;
  updateSettings: <K extends keyof RSVPSettings>(key: K, value: RSVPSettings[K]) => void;
  displayWords: (text: string, hash: string) => void;
  loadProjectWithProgress: (text: string, hash: string, savedProgress: number) => void;
  handleHide: () => Promise<void>;
}