import { RSVPCalculationService } from "../services";

interface TrailWordsProps {
  currentIndex: number;
  words: string[];
  trailWordsCount: number;
}

export const TrailWords = ({ currentIndex, words, trailWordsCount }: TrailWordsProps) => {
  const trailWords = RSVPCalculationService.getTrailWords(currentIndex, words, trailWordsCount);

  return (
    <div className="absolute top-32 left-0 right-0 flex flex-col items-center space-y-4 w-full">
      {trailWords.map((word, index) => {
        // Calculate font size: biggest (3rem) to smallest (2rem)
        const fontSize = 3 - (index * (1 / (trailWordsCount - 1)));
        const opacity = 0.7 - (index * (0.4 / (trailWordsCount - 1)));

        return (
          <div
            key={index}
            className="font-mono text-gray-400 m-0"
            style={{
              fontSize: `${fontSize}rem`,
              opacity: Math.max(opacity, 0.1)
            }}
          >
            {word}
          </div>
        );
      })}
    </div>
  );
};