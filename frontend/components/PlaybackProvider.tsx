"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Song } from "@/lib/types";

interface PlaybackContextValue {
  currentTrack: Song | null;
  queue: Song[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  playTrack: (track: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (nextTime: number) => void;
  rewind: () => void;
  fastForward: () => void;
  setVolumeLevel: (nextVolume: number) => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toPlayableSource(path: string) {
  if (!path) {
    return "";
  }

  return `/api/audio?src=${encodeURIComponent(path)}`;
}

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Song[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);

  const currentTrack = queue[currentIndex] ?? null;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = 0.7;
    audioRef.current = audio;

    function syncTime() {
      setCurrentTime(audio.currentTime);
    }

    function syncDuration() {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    }

    function syncEnded() {
      setCurrentTime(0);
      setCurrentIndex((index) => {
        if (index < 0 || index >= queueRef.current.length - 1) {
          setIsPlaying(false);
          return index;
        }
        return index + 1;
      });
    }

    function syncPause() {
      setIsPlaying(false);
    }

    function syncPlay() {
      setIsPlaying(true);
    }

    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("ended", syncEnded);
    audio.addEventListener("pause", syncPause);
    audio.addEventListener("play", syncPlay);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("ended", syncEnded);
      audio.removeEventListener("pause", syncPause);
      audio.removeEventListener("play", syncPlay);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      return;
    }

    const source = toPlayableSource(currentTrack.audio_file_path);
    if (audio.src !== new URL(source, window.location.origin).toString()) {
      audio.src = source;
      audio.load();
      setCurrentTime(0);
      setDuration(0);
    }

    if (!isPlaying) {
      return;
    }

    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isPlaying || !currentTrack) {
      return;
    }

    audio.pause();
  }, [currentTrack, isPlaying]);

  const playTrack = useCallback((track: Song, nextQueue?: Song[]) => {
    const sourceQueue = nextQueue && nextQueue.length > 0 ? nextQueue : [track];
    const nextIndex = sourceQueue.findIndex((item) => item.song_id === track.song_id);

    setQueue(sourceQueue);
    setCurrentIndex(nextIndex >= 0 ? nextIndex : 0);
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      return;
    }

    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  }, [currentTrack, isPlaying]);

  const playNext = useCallback(() => {
    setCurrentIndex((index) => {
      if (index < 0 || index >= queue.length - 1) {
        return index;
      }
      return index + 1;
    });
    setIsPlaying(true);
  }, [queue.length]);

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.currentTime > 5) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    setCurrentIndex((index) => {
      if (index <= 0) {
        return 0;
      }
      return index - 1;
    });
    setIsPlaying(true);
  }, []);

  const seekTo = useCallback((nextTime: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.currentTime = clamp(nextTime, 0, duration || 0);
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const rewind = useCallback(() => {
    seekTo(currentTime - 15);
  }, [currentTime, seekTo]);

  const fastForward = useCallback(() => {
    seekTo(currentTime + 15);
  }, [currentTime, seekTo]);

  const setVolumeLevel = useCallback((nextVolume: number) => {
    setVolume(clamp(nextVolume, 0, 1));
  }, []);

  const value = useMemo(
    () => ({
      currentTrack,
      queue,
      currentIndex,
      isPlaying,
      progress,
      currentTime,
      duration,
      volume,
      playTrack,
      togglePlay,
      playNext,
      playPrevious,
      seekTo,
      rewind,
      fastForward,
      setVolumeLevel,
    }),
    [
      currentIndex,
      currentTime,
      currentTrack,
      duration,
      fastForward,
      isPlaying,
      playNext,
      playPrevious,
      playTrack,
      progress,
      queue,
      rewind,
      seekTo,
      setVolumeLevel,
      togglePlay,
      volume,
    ],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error("usePlayback must be used within a PlaybackProvider.");
  }

  return context;
}
