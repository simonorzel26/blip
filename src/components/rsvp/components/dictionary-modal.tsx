'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, BookOpen, Volume2 } from 'lucide-react';
import { DictionaryAPI, DictionaryDefinition } from '@/lib/dictionary-api';

interface DictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: string;
}

export function DictionaryModal({ isOpen, onClose, word }: DictionaryModalProps) {
  const [definition, setDefinition] = useState<DictionaryDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && word) {
      loadDefinition();
    }
  }, [isOpen, word]);

  const loadDefinition = async () => {
    if (!word) return;

    console.log('Loading definition for word:', word);
    setLoading(true);
    setError(null);

    try {
      const result = await DictionaryAPI.lookupWord(word);
      console.log('Dictionary result:', result);
      setDefinition(result);

      if (!result) {
        setError('No definition found for this word');
      }
    } catch (err) {
      console.error('Dictionary lookup error:', err);
      setError('Failed to load definition');
    } finally {
      setLoading(false);
    }
  };

  const speakWord = () => {
    if (definition?.word) {
      console.log('Speaking word:', definition.word);
      const utterance = new SpeechSynthesisUtterance(definition.word);
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  const handleClose = () => {
    console.log('Closing dictionary modal');
    setDefinition(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-mono flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            {word}
            {definition?.phonetic && (
              <span className="text-gray-400 text-sm font-normal">
                {definition.phonetic}
              </span>
            )}
          </DialogTitle>
          <div className="flex items-center gap-2">
            {definition && (
              <Button
                size="sm"
                variant="ghost"
                onClick={speakWord}
                className="text-gray-400 hover:text-white"
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-gray-400 font-mono">Looking up definition...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-gray-400 font-mono">{error}</p>
            </div>
          )}

          {definition && (
            <div className="space-y-6">
              {definition.meanings.map((meaning, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-gray-800 text-gray-300 font-mono text-xs">
                      {meaning.partOfSpeech}
                    </Badge>
                  </div>

                  <div className="space-y-3 ml-4">
                    {meaning.definitions.map((def, defIndex) => (
                      <div key={defIndex} className="space-y-2">
                        <p className="text-gray-100 font-mono leading-relaxed">
                          {defIndex + 1}. {def.definition}
                        </p>

                        {def.example && (
                          <p className="text-gray-400 font-mono text-sm italic ml-4">
                            "{def.example}"
                          </p>
                        )}

                        {def.synonyms && def.synonyms.length > 0 && (
                          <div className="ml-4">
                            <span className="text-gray-500 font-mono text-xs">Synonyms: </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {def.synonyms.slice(0, 5).map((synonym, synIndex) => (
                                <Badge
                                  key={synIndex}
                                  variant="outline"
                                  className="bg-gray-800 border-gray-600 text-gray-300 font-mono text-xs"
                                >
                                  {synonym}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {def.antonyms && def.antonyms.length > 0 && (
                          <div className="ml-4">
                            <span className="text-gray-500 font-mono text-xs">Antonyms: </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {def.antonyms.slice(0, 3).map((antonym, antIndex) => (
                                <Badge
                                  key={antIndex}
                                  variant="outline"
                                  className="bg-gray-800 border-gray-600 text-gray-300 font-mono text-xs"
                                >
                                  {antonym}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {definition.origin && (
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-gray-400 font-mono text-sm">
                    <span className="text-gray-500">Origin: </span>
                    {definition.origin}
                  </p>
                </div>
              )}

              {definition.sourceUrls && definition.sourceUrls.length > 0 && (
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-gray-500 font-mono text-xs mb-2">Sources:</p>
                  <div className="space-y-1">
                    {definition.sourceUrls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-blue-400 hover:text-blue-300 font-mono text-xs truncate"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
