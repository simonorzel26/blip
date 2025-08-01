import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardService, hashString, RSVPCalculationService } from "../services";
import { useRSVP } from "../context";

export const WelcomeScreen = () => {
  const { displayWords } = useRSVP();

  const handleTestClick = async () => {
    console.log('Test button clicked');
    try {
      const isVisible = await invoke('toggle_window');
      console.log('Test window visibility:', isVisible);

      if (isVisible) {
        try {
          const text = await ClipboardService.readContent();
          console.log('Test clipboard content:', text);
          if (text) {
            displayWords(text, hashString(text));
          }
        } catch (error) {
          console.error('Test clipboard failed:', error);
        }
      }
    } catch (error) {
      console.error('Test toggle failed:', error);
    }
  };

  return (
    <div className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start w-full h-full">
      <Card className="bg-black/40 backdrop-blur-xl border-white/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-white">
            Tauri + Next.js Word Display
          </CardTitle>
          <CardDescription className="text-center text-white/70">
            Press <code className="font-mono font-semibold px-1 py-0.5 rounded bg-white/10">
              Option+C
            </code> to toggle the app and display clipboard words
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleTestClick}
            className="w-full text-white bg-white/10 hover:bg-white/20 border-white/20 backdrop-blur-sm"
          >
            Toggle Window & Test Clipboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};