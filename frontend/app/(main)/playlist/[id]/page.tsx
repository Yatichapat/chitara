"use client";

import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import SongCard from "@/components/SongCard";
import { usePlayback } from "@/components/PlaybackProvider";
import { Album, AlbumsResponse, ApiError, Song, SongsResponse } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PlaylistDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayback();
  const [searchTerm, setSearchTerm] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const isLibrary = id === "library";
  const albumId = Number(id);
  const selectedAlbum = albums.find((record) => record.album_id === albumId);
  const playlistName = isLibrary ? "Library" : selectedAlbum?.name || "Album";

  useEffect(() => {
    async function loadSongs() {
      setIsLoading(true);
      setError("");

      try {
        const [songsResponse, albumsResponse] = await Promise.all([
          fetch("/api/songs", { cache: "no-store" }),
          fetch("/api/albums", { cache: "no-store" }),
        ]);

        const songsPayload = (await songsResponse.json()) as SongsResponse & ApiError;
        if (!songsResponse.ok) {
          throw new Error(songsPayload.error || "Failed to load songs.");
        }

        if (albumsResponse.ok) {
          const albumsPayload = (await albumsResponse.json()) as AlbumsResponse;
          setAlbums(albumsPayload.albums || []);
        }

        const sorted = [...(songsPayload.songs || [])].sort((a, b) => b.song_id - a.song_id);

        setSongs(sorted);
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "Unexpected error.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSongs();
  }, []);

  const playlistSongs = useMemo(() => {
    if (isLibrary) {
      return songs;
    }

    if (!Number.isInteger(albumId)) {
      return [];
    }

    return songs.filter((song) => song.albums.includes(albumId));
  }, [albumId, isLibrary, songs]);

  const filteredSongs = playlistSongs.filter((song) => {
    const term = searchTerm.toLowerCase();
    return (
      song.title.toLowerCase().includes(term) ||
      song.genre.toLowerCase().includes(term) ||
      song.mood.toLowerCase().includes(term) ||
      song.occasion.toLowerCase().includes(term) ||
      song.created_date.includes(term)
    );
  });

  async function handleUpdateSongAlbums(songId: number, nextAlbumIds: number[]) {
    const currentSong = songs.find((song) => song.song_id === songId);
    if (!currentSong) {
      return;
    }

    const response = await fetch(`/api/songs/${songId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ albums: nextAlbumIds }),
    });

    const payload = (await response.json()) as Song & ApiError;
    if (!response.ok) {
      throw new Error(payload.error || "Failed to move song to album.");
    }

    setSongs((current) =>
      current.map((song) => (song.song_id === songId ? payload : song)),
    );
  }

  async function handleDeleteSong(songId: number) {
    const response = await fetch(`/api/songs/${songId}`, {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 204) {
      const payload = (await response.json()) as ApiError;
      throw new Error(payload.error || "Failed to delete song.");
    }

    setSongs((current) => current.filter((song) => song.song_id !== songId));
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-24 flex flex-col h-full">
      {/* Back nav */}
      <Link
        href="/playlist"
        className="inline-flex items-center gap-2 text-cafe-500 hover:text-cafe-900 transition-colors text-sm font-medium mb-6 self-start"
      >
        <ArrowLeft size={16} />
        Playlists
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-display font-bold text-cafe-900 mb-1">{playlistName}</h1>
        <p className="text-cafe-500 text-sm">
          {isLibrary
            ? "Every song you've generated, all in one place."
            : `${playlistSongs.length} song${playlistSongs.length !== 1 ? "s" : ""} in this album.`}
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="text-cafe-400" size={18} />
        </div>
        <input
          type="text"
          placeholder="Search by title, genre, mood, occasion, date..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-cafe-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cafe-400 text-cafe-900 placeholder:text-cafe-400 shadow-sm"
        />
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isLoading ? (
          <div className="text-center py-20 text-cafe-400">Loading songs...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : filteredSongs.length > 0 ? (
          filteredSongs.map((song) => (
            <SongCard
              key={song.song_id}
              songId={song.song_id}
              title={song.title}
              genre={song.genre}
              date={song.created_date.slice(0, 10)}
              isActive={currentTrack?.song_id === song.song_id}
              isPlaying={currentTrack?.song_id === song.song_id && isPlaying}
              onPlay={() => {
                if (currentTrack?.song_id === song.song_id) {
                  togglePlay();
                  return;
                }

                playTrack(song, filteredSongs);
              }}
              albumOptions={albums}
              currentAlbumIds={song.albums}
              onUpdateAlbums={async (songId, albumIds) => {
                try {
                  await handleUpdateSongAlbums(songId, albumIds);
                } catch (requestError) {
                  const message =
                    requestError instanceof Error
                      ? requestError.message
                      : "Failed to move song to album.";
                  setError(message);
                }
              }}
              onDelete={async (songId) => {
                try {
                  await handleDeleteSong(songId);
                } catch (requestError) {
                  const message =
                    requestError instanceof Error
                      ? requestError.message
                      : "Failed to delete song.";
                  setError(message);
                }
              }}
            />
          ))
        ) : (
          <div className="text-center py-20 text-cafe-400">
            {playlistSongs.length === 0
              ? "No songs in this album yet."
              : "No songs match your search."}
          </div>
        )}
      </div>
    </div>
  );
}
