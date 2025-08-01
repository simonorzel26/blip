import { RSVPCalculationService } from "../services";

interface CurrentWordProps {
  word: string;
  highlightORP: boolean;
  letterSpacing?: number;
}

export const CurrentWord = ({ word, highlightORP, letterSpacing = 0 }: CurrentWordProps) => {
  const orpIndex = RSVPCalculationService.getORPIndex(word);
  const maxLetters = 20; // Fixed grid size
  const centerPosition = Math.floor(maxLetters / 2) - 2; // Center position offset left (8)

  // Calculate how many letters to show before and after the ORP
  const lettersBeforeOrp = orpIndex;
  const lettersAfterOrp = word.length - orpIndex - 1;

  // Calculate starting position to center the ORP letter
  const startPosition = centerPosition - lettersBeforeOrp - 2;

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="font-mono relative">
        {/* Fixed grid with 20 positions and adjustable spacing */}
        <div
          className="grid grid-cols-20 w-full max-w-4xl"
          style={{ gap: `${letterSpacing}rem` }}
        >
          {Array.from({ length: maxLetters }, (_, gridIndex) => {
            const wordIndex = gridIndex - startPosition;
            const char = wordIndex >= 0 && wordIndex < word.length ? word[wordIndex] : '';
            const isOrpLetter = wordIndex === orpIndex;

            return (
              <div key={gridIndex} className="flex items-center justify-center">
                <span className={highlightORP && isOrpLetter ? 'text-red-400' : 'text-white/70'}>
                  {char}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};