"use client";

import { useEffect, useState } from "react";
import { Plus, BookOpen, Music } from "lucide-react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { getStoredAuthUser } from "@/lib/auth";
import { Album, AlbumsResponse, ApiError, SongsResponse } from "@/lib/types";

function PlaylistCard({
  href,
  name,
  meta,
  isLibrary = false,
}: {
  href: string;
  name: string;
  meta: string;
  isLibrary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-cafe-100 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md hover:border-cafe-300 transition-all"
    >
      {/* Cover placeholder */}
      <div
        className={`w-full aspect-square rounded-xl flex items-center justify-center ${
          isLibrary ? "bg-cafe-200" : "bg-cafe-100"
        } border border-cafe-200 group-hover:border-cafe-300 transition-colors`}
      >
        {isLibrary ? (
          <BookOpen size={40} className="text-cafe-500" />
        ) : (
          <Music size={40} className="text-cafe-400" />
        )}
      </div>

      <div>
        <h3 className="font-bold text-cafe-900 group-hover:text-cafe-700 transition-colors truncate">
          {name}
        </h3>
        <p className="text-cafe-500 text-sm mt-1">{meta}</p>
      </div>
    </Link>
  );
}

export default function PlaylistsPage() {
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [albums, setAlbums] = useState<Album[]>([]);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  }

  useEffect(() => {
    const storedUser = getStoredAuthUser();
    setCurrentUserId(storedUser?.user_id ?? null);

    async function loadPlaylistData() {
      try {
        const [songsResponse, albumsResponse] = await Promise.all([
          fetch("/api/songs", { cache: "no-store" }),
          fetch("/api/albums", { cache: "no-store" }),
        ]);

        if (songsResponse.ok) {
          const songsPayload = (await songsResponse.json()) as SongsResponse;
          const ownedSongs = storedUser
            ? (songsPayload.songs || []).filter((song) => song.creator_id === storedUser.user_id)
            : [];
          setLibraryCount(ownedSongs.length);
        }

        if (albumsResponse.ok) {
          const albumsPayload = (await albumsResponse.json()) as AlbumsResponse;
          const ownedAlbums = storedUser
            ? (albumsPayload.albums || []).filter((album) => album.creator_id === storedUser.user_id)
            : [];
          setAlbums(ownedAlbums);
        }
      } catch {
        // Keep fallback label if backend is unavailable.
      }
    }

    void loadPlaylistData();
  }, []);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const name = albumName.trim();
    if (!name) {
      return;
    }

    const currentUser = getStoredAuthUser();
    if (!currentUser) {
      setError("Please sign in with Google before creating an album.");
      return;
    }

    try {
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          creator_id: currentUser.user_id,
        }),
      });

      const payload = (await response.json()) as Album & ApiError;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create album.");
      }

      setAlbums((prev) => [payload, ...prev]);
      setIsAlbumModalOpen(false);
      setAlbumName("");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to create album.";
      setError(message);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-24">
      <header className="mb-8 flex items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-display font-bold text-cafe-900 mb-2">Playlists</h1>
          <p className="text-cafe-600 text-sm">Your library and custom collections.</p>
        </div>
        <button
          onClick={() => setIsAlbumModalOpen(true)}
          className="flex items-center gap-2 bg-cafe-800 text-cafe-50 px-5 py-2.5 rounded-xl font-medium hover:bg-cafe-900 transition-colors shadow-sm shrink-0"
        >
          <Plus size={18} />
          New Album
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Playlist Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Library card — always first */}
        <PlaylistCard
          href="/playlist/library"
          name="Library"
          meta={
            currentUserId === null
              ? "Sign in to view your songs"
              : libraryCount === null
                ? "All your generated songs"
                : `${libraryCount} song${libraryCount !== 1 ? "s" : ""}`
          }
          isLibrary
        />

        {/* Custom albums */}
        {albums.map((album) => (
          <PlaylistCard
            key={album.album_id}
            href={`/playlist/${album.album_id}`}
            name={album.name}
            meta={`${album.song_count} song${album.song_count !== 1 ? "s" : ""} · ${formatDate(album.created_date)}`}
          />
        ))}
      </div>

      {/* Create Album Modal */}
      <Modal
        isOpen={isAlbumModalOpen}
        onClose={() => setIsAlbumModalOpen(false)}
        title="New Album"
      >
        <form onSubmit={handleCreateAlbum} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-cafe-900 mb-2">Album Name</label>
            <input
              required
              type="text"
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              placeholder="e.g. My Study Beats"
              className="w-full px-4 py-3 bg-cafe-50 border border-cafe-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cafe-400 text-cafe-900 placeholder:text-cafe-400"
            />
          </div>
          <p className="text-xs text-cafe-500">
            You can add songs to this album later from the song options menu.
          </p>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAlbumModalOpen(false)}
              className="px-5 py-2.5 rounded-xl font-medium text-cafe-700 hover:bg-cafe-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-medium bg-cafe-800 text-cafe-50 hover:bg-cafe-900 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
