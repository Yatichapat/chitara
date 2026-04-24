"use client";

import {
  AlertCircle,
  Coffee,
  Download,
  Globe,
  Loader2,
  LogIn,
  Pause,
  Play,
  RotateCcw,
  Users,
} from "lucide-react";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  consumeGoogleAuthCallback,
  getStoredAuthUser,
  storeAuthUser,
} from "@/lib/auth";
import { ApiError, PrivacyLevel, Song } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getAudioUrl(song: Song) {
  return `/api/audio?src=${encodeURIComponent(song.audio_file_path)}`;
}

function getDownloadUrl(song: Song) {
  const safeTitle =
    song.title
      .replace(/[^a-zA-Z0-9-_\s]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "song";
  return `/api/audio?src=${encodeURIComponent(song.audio_file_path)}&download=1&filename=${encodeURIComponent(`${safeTitle}.mp3`)}`;
}

function privacyLabel(privacyLevel: PrivacyLevel) {
  if (privacyLevel === "invite_only") {
    return "Invitation Only";
  }
  return privacyLevel.charAt(0).toUpperCase() + privacyLevel.slice(1);
}

export default function SharedSongPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const songId = Number(id);
  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState("");
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const callbackUser = consumeGoogleAuthCallback(searchParams);
    if (callbackUser) {
      storeAuthUser(callbackUser);
      setAuthVersion((current) => current + 1);
      setIsRedirecting(false);
      router.replace(`/share/${id}`);
      return;
    }

    if (searchParams.get("google_auth") === "error") {
      setError(searchParams.get("error") || "Google sign-in failed.");
      setRequiresSignIn(true);
      setIsLoading(false);
      setIsRedirecting(false);
      router.replace(`/share/${id}`);
    }
  }, [id, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedSong() {
      setIsLoading(true);
      setError("");
      setRequiresSignIn(false);

      if (!Number.isInteger(songId)) {
        setError("This shared song link is invalid.");
        setIsLoading(false);
        return;
      }

      try {
        const viewerEmail = getStoredAuthUser()?.email;
        const query = viewerEmail ? `?email=${encodeURIComponent(viewerEmail)}` : "";
        const response = await fetch(`/api/share/${songId}${query}`, { cache: "no-store" });
        const payload = (await response.json()) as Song & ApiError;
        if (!response.ok) {
          if (!viewerEmail && response.status === 403) {
            setRequiresSignIn(true);
          }
          throw new Error(payload.error || "Failed to load shared song.");
        }

        if (!payload.audio_file_path) {
          throw new Error("This song is not ready to play yet.");
        }

        if (!cancelled) {
          setSong(payload);
        }
      } catch (requestError) {
        if (!cancelled) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : "This shared song link is unavailable.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSharedSong();

    return () => {
      cancelled = true;
    };
  }, [authVersion, songId]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [song?.song_id]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play();
      return;
    }

    audio.pause();
  }

  function restartPlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play();
  }

  function handleSeek(value: number) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.currentTime = value;
    setCurrentTime(value);
  }

  function handleGoogleLogin() {
    if (isRedirecting || typeof window === "undefined") {
      return;
    }

    setIsRedirecting(true);
    const nextPath = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/auth/google/redirect?next=${encodeURIComponent(nextPath)}`);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-cafe-50 px-4 text-cafe-700">
        <Loader2 size={28} className="animate-spin mb-3" />
        <p className="text-sm font-medium">Loading shared song...</p>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-cafe-50 max-w-md mx-auto text-center px-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-cafe-900 mb-2">
          {requiresSignIn ? "Sign In Required" : "Link Unavailable"}
        </h1>
        <p className="text-cafe-600 mb-8">
          {error || "The song you're trying to access might have been deleted or set to private."}
        </p>
        {requiresSignIn ? (
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isRedirecting}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-cafe-800 text-cafe-50 rounded-xl hover:bg-cafe-900 transition-colors font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <LogIn size={18} />
            {isRedirecting ? "Redirecting..." : "Continue with Google"}
          </button>
        ) : (
          <Link href="/" className="px-6 py-3 bg-cafe-800 text-cafe-50 rounded-xl hover:bg-cafe-900 transition-colors font-medium">
            Create Your Own AI Song
          </Link>
        )}
      </div>
    );
  }

  const PrivacyIcon = song.privacy_level === "invite_only" ? Users : Globe;

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
          <div className="absolute inset-0 bg-cafe-800 opacity-30 mix-blend-multiply" />
          <Coffee size={64} className="text-white mix-blend-overlay" />
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cafe-200 bg-cafe-50 px-3 py-1 text-xs font-semibold text-cafe-600 mb-3">
            <PrivacyIcon size={13} />
            {privacyLabel(song.privacy_level)}
          </div>
          <h2 className="text-2xl font-bold text-cafe-900 mb-2">{song.title}</h2>
          <p className="text-cafe-500 font-medium text-sm">
            {song.genre} • {song.mood} • {song.occasion}
          </p>
          <p className="text-cafe-400 text-xs mt-1">Created {formatDate(song.created_date)}</p>
        </div>

        <audio
          ref={audioRef}
          src={getAudioUrl(song)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onError={() => setError("This song audio could not be loaded.")}
        />

        <div className="space-y-6">
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => handleSeek(Number(event.target.value))}
              className="w-full accent-cafe-700"
              aria-label="Track progress"
            />
            <div className="flex justify-between text-xs text-cafe-500 font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex justify-center items-center gap-6">
            <button
              type="button"
              onClick={restartPlayback}
              className="text-cafe-400 hover:text-cafe-700 transition-colors p-2"
              title="Restart"
            >
              <RotateCcw size={20} />
            </button>
            <button
              type="button"
              onClick={togglePlayback}
              className="w-16 h-16 flex items-center justify-center bg-cafe-800 text-cafe-50 rounded-full hover:bg-cafe-900 transition-transform active:scale-95 shadow-md"
            >
              {isPlaying ? (
                <Pause size={32} fill="currentColor" />
              ) : (
                <Play size={32} fill="currentColor" className="ml-1" />
              )}
            </button>
            <a
              href={getDownloadUrl(song)}
              className="text-cafe-400 hover:text-cafe-700 transition-colors p-2"
              title="Download"
            >
              <Download size={20} />
            </a>
          </div>
        </div>
      </div>

      <p className="mt-8 text-cafe-400 text-sm font-medium">
        Want to generate your own music?{" "}
        <Link href="/" className="text-cafe-700 underline underline-offset-2">Try Chitara</Link>
      </p>
    </div>
  );
}
