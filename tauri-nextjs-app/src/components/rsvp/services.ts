import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { RSVPState, RSVPSettings } from "./types";

export const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

export class ClipboardService {
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

export class StatePersistenceService {
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
            letterSpacing: parsed.letterSpacing || 3.5,
            punctuationDelay: parsed.punctuationDelay || 10,
            trailWordsCount: parsed.trailWordsCount || 5,
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

export class FileProcessingService {
  static getFileMetadata(content: string): { totalWords: number; estimatedPages: number } {
    const wordArray = content.split(/\s+/).filter(word => word.length > 0);
    const totalWords = wordArray.length;
    const estimatedPages = Math.ceil(totalWords / 250); // ~250 words per page

    return { totalWords, estimatedPages };
  }

  static processTextInChunks(text: string, startIndex: number = 0, chunkSize: number = 1000): {
    words: string[];
    maxLength: number;
    hasMore: boolean;
    totalWords: number;
  } {
    const wordArray = text.split(/\s+/).filter(word => word.length > 0);
    const totalWords = wordArray.length;

    // Get chunk of words
    const endIndex = Math.min(startIndex + chunkSize, totalWords);
    const chunkWords = wordArray.slice(startIndex, endIndex);

    // Process chunk
    const truncatedWords = chunkWords.map(word => word.length > 20 ? word.substring(0, 20) : word);
    const maxLength = Math.max(...truncatedWords.map(word => word.length));

    return {
      words: truncatedWords,
      maxLength,
      hasMore: endIndex < totalWords,
      totalWords
    };
  }

  static getWordAtPosition(text: string, position: number): string | null {
    const wordArray = text.split(/\s+/).filter(word => word.length > 0);
    return wordArray[position] || null;
  }
}

export class RSVPCalculationService {
  static getDelay(word: string, settings: RSVPSettings, currentIndex: number, allWords: string[]): number {
    let baseDelay = settings.timePerWord + (word.length * settings.timePerCharacter);

    // Smart timing adjustments
    baseDelay += this.getPunctuationDelay(word, settings);
    baseDelay += this.getWordLengthAdjustment(word, settings);

    return baseDelay;
  }

  private static getPunctuationDelay(word: string, settings: RSVPSettings): number {
    const punctuationMarks = [',', ';', ':', '!', '?', '.', '...', '\n\n'];
    let delay = 0;

    for (const mark of punctuationMarks) {
      if (word.includes(mark)) {
        delay += settings.punctuationDelay;
      }
    }

    return delay;
  }

  private static getWordLengthAdjustment(word: string, settings: RSVPSettings): number {
    return settings.timePerWord + (word.length * settings.timePerCharacter);
  }

  static getEffectiveWPM(words: string[], settings: RSVPSettings, globalWordIndex?: number): number {
    if (words.length === 0) return 0;

    // Limit to first 500 words to prevent stack overflow with large files
    const wordsToProcess = words.slice(0, 500);

    // Calculate average delay including smart timing
    let totalDelay = 0;
    for (let i = 0; i < wordsToProcess.length; i++) {
      totalDelay += this.getDelay(wordsToProcess[i], settings, i, wordsToProcess);
    }

    const avgTimePerWord = totalDelay / wordsToProcess.length;
    return Math.round((60 * 1000) / avgTimePerWord);
  }

  static getORPIndex(word: string): number {
    return Math.floor(word.length / 3);
  }

  static getTrailWords(currentIndex: number, words: string[], trailWordsCount: number): string[] {
    if (currentIndex === 0) return Array(trailWordsCount).fill('');

    const actualCount = Math.min(currentIndex, trailWordsCount);
    const startIndex = currentIndex - actualCount;
    const trailWords = words.slice(startIndex, currentIndex);
    return trailWords.reverse();
  }

  static processText(text: string): { words: string[]; maxLength: number } {
    const wordArray = text.split(/\s+/).filter(word => word.length > 0);

    // Process in batches to prevent stack overflow
    const batchSize = 10000;
    const maxWords = 50000; // Conservative limit
    const limitedWords = wordArray.slice(0, maxWords);

    // Process words in batches
    const truncatedWords: string[] = [];
    for (let i = 0; i < limitedWords.length; i += batchSize) {
      const batch = limitedWords.slice(i, i + batchSize);
      const processedBatch = batch.map(word => word.length > 20 ? word.substring(0, 20) : word);
      truncatedWords.push(...processedBatch);
    }

    const maxLength = Math.max(...truncatedWords.map(word => word.length));
    return { words: truncatedWords, maxLength };
  }
}

export class FileBasedReader {
  private filePath: string | null = null;
  private totalWords: number = 0;
  private wordCache: Map<number, string> = new Map();
  private readonly cacheSize = 1000; // Cache 1000 words at a time

  async loadFile(filePath: string): Promise<{ totalWords: number; estimatedPages: number }> {
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(filePath);

      // Get total word count
      const wordArray = content.split(/\s+/).filter(word => word.length > 0);
      this.totalWords = wordArray.length;
      this.filePath = filePath;

      // Cache first batch of words
      await this.cacheWords(0, Math.min(this.cacheSize, this.totalWords));

      const estimatedPages = Math.ceil(this.totalWords / 250);
      return { totalWords: this.totalWords, estimatedPages };
    } catch (error) {
      console.error('Failed to load file:', error);
      throw error;
    }
  }

  async getWords(startIndex: number, count: number): Promise<string[]> {
    if (!this.filePath) {
      throw new Error('No file loaded');
    }

    const endIndex = Math.min(startIndex + count, this.totalWords);
    const words: string[] = [];

    // Load the batch containing the start index
    const batchStart = Math.floor(startIndex / this.cacheSize) * this.cacheSize;
    await this.cacheWords(batchStart, Math.min(this.cacheSize, this.totalWords - batchStart));

    // Get words from the requested range
    for (let i = startIndex; i < endIndex; i++) {
      const word = await this.getWordAt(i);
      if (word) {
        words.push(word);
      }
    }

    return words;
  }

  async getWordAt(index: number): Promise<string | null> {
    if (!this.filePath || index >= this.totalWords) {
      return null;
    }

    // Check cache first
    if (this.wordCache.has(index)) {
      return this.wordCache.get(index) || null;
    }

    // Load the batch containing this word
    const batchStart = Math.floor(index / this.cacheSize) * this.cacheSize;
    await this.cacheWords(batchStart, Math.min(this.cacheSize, this.totalWords - batchStart));

    return this.wordCache.get(index) || null;
  }

  private async cacheWords(startIndex: number, count: number): Promise<void> {
    if (!this.filePath) return;

    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(this.filePath);
      const wordArray = content.split(/\s+/).filter(word => word.length > 0);

      // Clear old cache entries to prevent memory bloat
      if (this.wordCache.size > this.cacheSize * 2) {
        this.wordCache.clear();
      }

      // Cache the requested words
      for (let i = 0; i < count; i++) {
        const globalIndex = startIndex + i;
        if (globalIndex < wordArray.length) {
          const word = wordArray[globalIndex];
          this.wordCache.set(globalIndex, word.length > 20 ? word.substring(0, 20) : word);
        }
      }
    } catch (error) {
      console.error('Failed to cache words:', error);
    }
  }

  getTotalWords(): number {
    return this.totalWords;
  }

  clearCache(): void {
    this.wordCache.clear();
  }
}