"use client";

import {
  FastForward,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { usePlayback } from "@/components/PlaybackProvider";

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function Player() {
  const {
    currentTrack,
    currentIndex,
    queue,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    rewind,
    fastForward,
    setVolumeLevel,
  } = usePlayback();

  const hasTrack = Boolean(currentTrack);
  const canGoBack = currentIndex > 0 || currentTime > 5;
  const canGoForward = currentIndex >= 0 && currentIndex < queue.length - 1;

  return (
    <div className="h-24 bg-cafe-50 border-t border-cafe-200 flex items-center justify-between px-4 lg:px-8 shadow-[0_-4px_20px_rgba(66,42,29,0.05)] w-full shrink-0 z-50 gap-4">
      <div className="flex items-center gap-4 w-[28%] min-w-0">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasTrack}
          className="w-14 h-14 bg-cafe-200 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPlaying ? (
            <Pause size={24} className="text-cafe-800" fill="currentColor" />
          ) : (
            <Play size={24} className="text-cafe-800 ml-0.5" fill="currentColor" />
          )}
        </button>
        <div className="overflow-hidden">
          <h4 className="text-cafe-900 font-bold truncate">
            {currentTrack?.title ?? "Choose a song"}
          </h4>
          <p className="text-cafe-600 text-sm truncate">
            {currentTrack
              ? `${currentTrack.genre} • ${currentTrack.mood || currentTrack.occasion}`
              : "Select a song from Library or a playlist to start playback."}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 max-w-2xl px-2 lg:px-6">
        <div className="flex items-center gap-4 lg:gap-6 mb-2">
          <button
            type="button"
            onClick={rewind}
            disabled={!hasTrack}
            className="text-cafe-600 hover:text-cafe-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Rewind 15s"
          >
            <Rewind size={20} />
          </button>

          <button
            type="button"
            onClick={playPrevious}
            disabled={!hasTrack || !canGoBack}
            className="text-cafe-700 hover:text-cafe-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SkipBack size={24} />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasTrack}
            className="w-12 h-12 flex items-center justify-center bg-cafe-800 text-cafe-50 rounded-full hover:bg-cafe-900 transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" className="ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={playNext}
            disabled={!hasTrack || !canGoForward}
            className="text-cafe-700 hover:text-cafe-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SkipForward size={24} />
          </button>

          <button
            type="button"
            onClick={fastForward}
            disabled={!hasTrack}
            className="text-cafe-600 hover:text-cafe-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Fast forward 15s"
          >
            <FastForward size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full text-xs text-cafe-600 font-medium">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            disabled={!hasTrack}
            className="flex-1 accent-cafe-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Track progress"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="w-[22%] min-w-[180px] hidden md:flex items-center justify-end gap-3 text-cafe-700">
        {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => setVolumeLevel(Number(event.target.value))}
          className="w-24 accent-cafe-700"
          aria-label="Volume"
        />
        <span className="text-xs w-9 text-right">{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}
