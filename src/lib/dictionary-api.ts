export interface DictionaryDefinition {
  word: string;
  phonetic?: string;
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }[];
  }[];
  origin?: string;
  license?: {
    name: string;
    url: string;
  };
  sourceUrls?: string[];
}

export class DictionaryAPI {
  private static cache = new Map<string, DictionaryDefinition | null>();
  private static readonly BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

  static async lookupWord(word: string): Promise<DictionaryDefinition | null> {
    const cleanWord = word.toLowerCase().replace(/[^\w\s]/g, '');

    console.log('Dictionary lookup requested for:', word, 'cleaned to:', cleanWord);

    if (this.cache.has(cleanWord)) {
      console.log('Returning cached result for:', cleanWord);
      return this.cache.get(cleanWord) || null;
    }

    try {
      console.log('Fetching definition from API for:', cleanWord);
      const response = await fetch(`${this.BASE_URL}/${encodeURIComponent(cleanWord)}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('No definition found for:', cleanWord);
          this.cache.set(cleanWord, null);
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const definition = data[0] as DictionaryDefinition;

      console.log('Successfully retrieved definition for:', cleanWord, definition);
      this.cache.set(cleanWord, definition);
      return definition;
    } catch (error) {
      console.error('Dictionary lookup failed for:', cleanWord, error);
      this.cache.set(cleanWord, null);
      return null;
    }
  }

  static clearCache(): void {
    console.log('Clearing dictionary cache');
    this.cache.clear();
  }

  static getCachedWord(word: string): DictionaryDefinition | null {
    const cleanWord = word.toLowerCase().replace(/[^\w\s]/g, '');
    return this.cache.get(cleanWord) || null;
  }
}
