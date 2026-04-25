"use client";

import {
  AlertCircle,
  Coffee,
  Download,
  Globe,
  Loader2,
  LogIn,
  Music,
  Pause,
  Play,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import {
  consumeGoogleAuthCallback,
  getStoredAuthUser,
  storeAuthUser,
} from "@/lib/auth";
import { ApiError, PrivacyLevel, SharedAlbumResponse, Song } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
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

function privacyLabel(privacyLevel: PrivacyLevel) {
  if (privacyLevel === "invite_only") {
    return "Invitation Only";
  }
  return privacyLevel.charAt(0).toUpperCase() + privacyLevel.slice(1);
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

export default function SharedAlbumPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const albumId = Number(id);
  const [albumData, setAlbumData] = useState<SharedAlbumResponse | null>(null);
  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const callbackUser = consumeGoogleAuthCallback(searchParams);
    if (callbackUser) {
      storeAuthUser(callbackUser);
      setAuthVersion((current) => current + 1);
      setIsRedirecting(false);
      router.replace(`/share/album/${id}`);
      return;
    }

    if (searchParams.get("google_auth") === "error") {
      setError(searchParams.get("error") || "Google sign-in failed.");
      setRequiresSignIn(true);
      setIsLoading(false);
      setIsRedirecting(false);
      router.replace(`/share/album/${id}`);
    }
  }, [id, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedAlbum() {
      setIsLoading(true);
      setError("");
      setRequiresSignIn(false);

      if (!Number.isInteger(albumId)) {
        setError("This shared album link is invalid.");
        setIsLoading(false);
        return;
      }

      try {
        const viewerEmail = getStoredAuthUser()?.email;
        const query = viewerEmail ? `?email=${encodeURIComponent(viewerEmail)}` : "";
        const response = await fetch(`/api/share/album/${albumId}${query}`, { cache: "no-store" });
        const payload = (await response.json()) as SharedAlbumResponse & ApiError;
        if (!response.ok) {
          if (!viewerEmail && response.status === 403) {
            setRequiresSignIn(true);
          }
          throw new Error(payload.error || "Failed to load shared album.");
        }

        if (!cancelled) {
          setAlbumData(payload);
        }
      } catch (requestError) {
        if (!cancelled) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : "This shared album link is unavailable.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSharedAlbum();

    return () => {
      cancelled = true;
    };
  }, [albumId, authVersion]);

  function handleGoogleLogin() {
    if (isRedirecting || typeof window === "undefined") {
      return;
    }

    setIsRedirecting(true);
    const nextPath = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/auth/google/redirect?next=${encodeURIComponent(nextPath)}`);
  }

  function toggleSong(song: Song) {
    if (!song.audio_file_path) {
      setError("This song is not ready to play yet.");
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (activeSongId === song.song_id) {
      if (audio.paused) {
        void audio.play();
      } else {
        audio.pause();
      }
      return;
    }

    setActiveSongId(song.song_id);
    audio.src = getAudioUrl(song);
    void audio.play();
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-cafe-50 px-4 text-cafe-700">
        <Loader2 size={28} className="animate-spin mb-3" />
        <p className="text-sm font-medium">Loading shared album...</p>
      </div>
    );
  }

  if (error || !albumData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-cafe-50 max-w-md mx-auto text-center px-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-cafe-900 mb-2">
          {requiresSignIn ? "Sign In Required" : "Album Unavailable"}
        </h1>
        <p className="text-cafe-600 mb-8">
          {error || "The album you're trying to access might have been deleted or set to private."}
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

  const { album, songs } = albumData;
  const PrivacyIcon = album.privacy_level === "invite_only" ? Users : Globe;

  return (
    <div className="min-h-screen bg-cafe-50 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-display font-bold text-cafe-900 tracking-wider flex items-center gap-2 mb-8">
          <Coffee size={20} className="text-cafe-600" />
          <span className="opacity-90">Chitara Shared</span>
        </h1>

        <section className="bg-white border border-cafe-200 rounded-3xl p-6 shadow-xl mb-4">
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-2xl bg-cafe-100 border-4 border-cafe-50 flex items-center justify-center shrink-0">
              <Music size={40} className="text-cafe-400" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cafe-200 bg-cafe-50 px-3 py-1 text-xs font-semibold text-cafe-600 mb-2">
                <PrivacyIcon size={13} />
                {privacyLabel(album.privacy_level)}
              </div>
              <h2 className="text-3xl font-bold text-cafe-900 truncate">{album.name}</h2>
              <p className="text-cafe-500 text-sm mt-1">
                {songs.length} song{songs.length !== 1 ? "s" : ""} · Created {formatDate(album.created_date)}
              </p>
            </div>
          </div>
        </section>

        <audio
          ref={audioRef}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => setError("This song audio could not be loaded.")}
        />

        <div className="space-y-3">
          {songs.length === 0 ? (
            <div className="bg-white border border-cafe-200 rounded-2xl px-5 py-10 text-center text-cafe-400">
              No songs in this shared album yet.
            </div>
          ) : (
            songs.map((song) => {
              const active = activeSongId === song.song_id;
              return (
                <div
                  key={song.song_id}
                  className="bg-white border border-cafe-100 rounded-2xl p-4 flex items-center justify-between gap-4"
                >
                  <button
                    type="button"
                    onClick={() => toggleSong(song)}
                    className="flex items-center gap-4 min-w-0 text-left"
                  >
                    <span className="w-12 h-12 rounded-xl bg-cafe-100 flex items-center justify-center shrink-0">
                      {active && isPlaying ? (
                        <Pause size={18} className="text-cafe-700" fill="currentColor" />
                      ) : (
                        <Play size={18} className="text-cafe-700 ml-0.5" fill="currentColor" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-cafe-900 truncate">{song.title}</span>
                      <span className="block text-xs text-cafe-500 capitalize truncate">
                        {song.genre} · {song.mood} · {song.occasion}
                      </span>
                    </span>
                  </button>
                  {song.audio_file_path && (
                    <a
                      href={getDownloadUrl(song)}
                      className="text-cafe-400 hover:text-cafe-700 transition-colors p-2 shrink-0"
                      title="Download"
                    >
                      <Download size={18} />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>

        <p className="mt-8 text-center text-cafe-400 text-sm font-medium">
          Want to generate your own music?{" "}
          <Link href="/" className="text-cafe-700 underline underline-offset-2">Try Chitara</Link>
        </p>
      </div>
    </div>
  );
}
