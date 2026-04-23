"use client";

import { Play, Pause, AlertCircle, Coffee, RotateCcw } from "lucide-react";
import { useState, useEffect, use } from "react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SharedSongPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Mock checking if link is valid
  useEffect(() => {
    if (resolvedParams.id === "broken" || resolvedParams.id === "invalid") {
      setHasError(true);
    }
  }, [resolvedParams.id]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-cafe-900 mb-2">Link Unavailable</h1>
        <p className="text-cafe-600 mb-8">
          The song you're trying to access might have been deleted, set to private, or the link is broken.
        </p>
        <Link href="/" className="px-6 py-3 bg-cafe-800 text-cafe-50 rounded-xl hover:bg-cafe-900 transition-colors font-medium">
          Create Your Own AI Song
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cafe-50 px-4">
      
      <div className="absolute top-8 left-8">
         <h1 className="text-xl font-display font-bold text-cafe-900 tracking-wider flex items-center gap-2">
            <Coffee size={20} className="text-cafe-600" />
            <span className="opacity-90">Chitara Shared</span>
         </h1>
      </div>

      <div className="w-full max-w-md bg-white border border-cafe-200 rounded-3xl p-8 shadow-xl">
        <div className="aspect-square w-full bg-cafe-100 rounded-2xl mb-6 flex items-center justify-center border-4 border-cafe-50 overflow-hidden relative shadow-sm">
           {/* Abstract Cover */}
           <div className="absolute inset-0 bg-cafe-200 opacity-30 mix-blend-multiply"></div>
           <Coffee size={64} className="text-cafe-400 mix-blend-overlay" />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-cafe-900 mb-1">Morning Routine Jazz</h2>
          <p className="text-cafe-500 font-medium text-sm">Created via Chitara AI</p>
        </div>

        <div className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="h-2 w-full bg-cafe-100 rounded-full overflow-hidden cursor-pointer">
              <div className="h-full bg-cafe-600 rounded-full w-1/3"></div>
            </div>
            <div className="flex justify-between text-xs text-cafe-500 font-medium">
              <span>1:04</span>
              <span>3:15</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center gap-6">
            <button className="text-cafe-400 hover:text-cafe-700 transition-colors p-2">
              <RotateCcw size={20} />
            </button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-16 h-16 flex items-center justify-center bg-cafe-800 text-cafe-50 rounded-full hover:bg-cafe-900 transition-transform active:scale-95 shadow-md"
            >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
            </button>
            <button className="text-cafe-400 hover:text-cafe-700 transition-colors p-2">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </div>
        </div>
      </div>

      <p className="mt-8 text-cafe-400 text-sm font-medium">
        Want to generate your own music? <Link href="/" className="text-cafe-700 underline underline-offset-2">Try Chitara</Link>
      </p>

    </div>
  );
}
