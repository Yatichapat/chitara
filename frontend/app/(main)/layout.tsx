import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import Player from "@/components/Player";
import { PlaybackProvider } from "@/components/PlaybackProvider";

export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <PlaybackProvider>
      <>
        <div className="flex flex-1 overflow-hidden h-full">
          <Suspense fallback={<div className="w-80 shrink-0" aria-hidden="true" />}>
            <Sidebar />
          </Suspense>

          <main className="flex-1 overflow-y-auto p-8 lg:p-12 relative flex flex-col h-full">
            {children}
          </main>
        </div>

        <Player />
      </>
    </PlaybackProvider>
  );
}
