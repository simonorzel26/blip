"use client";

import { RSVPProvider, RSVPDisplay, WelcomeScreen, useRSVP } from "@/components/rsvp";

const AppContent = () => {
  const { state } = useRSVP();

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}>
      <div className="w-full h-full">
        {state.isDisplayingWords ? (
          <RSVPDisplay />
        ) : (
          <WelcomeScreen />
        )}
      </div>
    </div>
  );
};

export default function Home() {
  return (
    <RSVPProvider>
      <AppContent />
    </RSVPProvider>
  );
}
