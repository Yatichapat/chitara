"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  BookOpen,
  Music,
  Globe,
  Users,
  Lock,
  Check,
  MoreVertical,
  Link2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { getStoredAuthUser } from "@/lib/auth";
import { Album, AlbumsResponse, ApiError, PrivacyLevel, SongsResponse } from "@/lib/types";

const PRIVACY_OPTIONS: Array<{
  value: PrivacyLevel;
  label: string;
  description: string;
  icon: typeof Globe;
}> = [
  {
    value: "public",
    label: "Public",
    description: "Anyone with the link can listen.",
    icon: Globe,
  },
  {
    value: "invite_only",
    label: "Invitation Only",
    description: "Only invited listeners can access it.",
    icon: Users,
  },
  {
    value: "private",
    label: "Private",
    description: "Only you can access it.",
    icon: Lock,
  },
];

function PlaylistCard({
  href,
  name,
  meta,
  privacyLevel,
  invitedEmails = [],
  isLibrary = false,
  albumId,
  onUpdateShare,
}: {
  href: string;
  name: string;
  meta: string;
  privacyLevel?: PrivacyLevel;
  invitedEmails?: string[];
  isLibrary?: boolean;
  albumId?: number;
  onUpdateShare?: (
    albumId: number,
    privacyLevel: PrivacyLevel,
    invitedEmails: string[],
  ) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<"root" | "share">("root");
  const [currentPrivacy, setCurrentPrivacy] = useState<PrivacyLevel>(privacyLevel || "private");
  const [inviteEmailText, setInviteEmailText] = useState(invitedEmails.join(", "));
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [isSavingInvites, setIsSavingInvites] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const PrivacyIcon = privacyLevel
    ? PRIVACY_OPTIONS.find((option) => option.value === privacyLevel)?.icon
    : undefined;
  const CurrentPrivacyIcon =
    PRIVACY_OPTIONS.find((option) => option.value === currentPrivacy)?.icon ?? Lock;

  useEffect(() => {
    setCurrentPrivacy(privacyLevel || "private");
  }, [privacyLevel]);

  useEffect(() => {
    setInviteEmailText(invitedEmails.join(", "));
  }, [invitedEmails]);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setTimeout(() => setMenuView("root"), 150);
      }
    }

    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function parseInviteEmails() {
    const seen = new Set<string>();
    return inviteEmailText
      .split(/[\n,]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => {
        if (!email || seen.has(email)) {
          return false;
        }
        seen.add(email);
        return true;
      });
  }

  async function handleUpdateShare(nextPrivacy: PrivacyLevel) {
    if (!albumId || !onUpdateShare || isUpdatingShare) {
      setCurrentPrivacy(nextPrivacy);
      return;
    }

    const previousPrivacy = currentPrivacy;
    setCurrentPrivacy(nextPrivacy);
    setIsUpdatingShare(true);
    try {
      await onUpdateShare(albumId, nextPrivacy, parseInviteEmails());
    } catch {
      setCurrentPrivacy(previousPrivacy);
    } finally {
      setIsUpdatingShare(false);
    }
  }

  async function handleSaveInvites() {
    if (!albumId || !onUpdateShare || isSavingInvites) return;

    setIsSavingInvites(true);
    try {
      await onUpdateShare(albumId, "invite_only", parseInviteEmails());
      setCurrentPrivacy("invite_only");
    } finally {
      setIsSavingInvites(false);
    }
  }

  function handleCopyAlbumLink() {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "https://chitara.app";
    navigator.clipboard.writeText(`${origin}/share/album/${albumId ?? "demo"}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  const albumMenu =
    !isLibrary && albumId ? (
      <div className="relative shrink-0 -mr-1" ref={menuRef}>
        <button
          type="button"
          onClick={() => {
            setMenuOpen((open) => !open);
            setMenuView("root");
          }}
          className="p-1.5 text-cafe-400 hover:text-cafe-800 hover:bg-cafe-50 rounded-full transition-colors"
          aria-label="Album options"
        >
          <MoreVertical size={18} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-cafe-100 rounded-2xl shadow-xl z-50 overflow-hidden">
            {menuView === "root" && (
              <div className="p-1.5">
                <button
                  type="button"
                  onClick={() => setMenuView("share")}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-cafe-700 rounded-xl hover:bg-cafe-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CurrentPrivacyIcon size={16} className="text-cafe-500" />
                    Share Album
                  </span>
                  <ChevronRight size={14} className="text-cafe-400" />
                </button>
              </div>
            )}

            {menuView === "share" && (
              <div className="p-1.5">
                <button
                  type="button"
                  onClick={() => setMenuView("root")}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-cafe-500 hover:text-cafe-800 transition-colors mb-1"
                >
                  <ChevronLeft size={14} />
                  Album share options
                </button>

                {PRIVACY_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => void handleUpdateShare(value)}
                    disabled={isUpdatingShare}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-xl hover:bg-cafe-50 transition-colors ${
                      currentPrivacy === value
                        ? "text-cafe-900 font-semibold"
                        : "text-cafe-700"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={16} className="text-cafe-500" />
                      {label}
                    </span>
                    {currentPrivacy === value && <Check size={14} className="text-cafe-700" />}
                  </button>
                ))}

                <div className="my-1 border-t border-cafe-100" />

                {currentPrivacy === "invite_only" && (
                  <div className="px-3 py-2">
                    <label className="block text-xs font-semibold text-cafe-500 mb-1.5">
                      Invited emails
                    </label>
                    <textarea
                      value={inviteEmailText}
                      onChange={(event) => setInviteEmailText(event.target.value)}
                      placeholder="friend@example.com, team@example.com"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-cafe-200 bg-cafe-50 px-3 py-2 text-xs text-cafe-900 placeholder:text-cafe-400 focus:outline-none focus:ring-2 focus:ring-cafe-300"
                    />
                    <button
                      type="button"
                      onClick={handleSaveInvites}
                      disabled={isSavingInvites}
                      className="mt-2 w-full py-2 text-xs font-semibold rounded-xl bg-cafe-800 text-cafe-50 hover:bg-cafe-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingInvites ? "Saving..." : "Save Invites"}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCopyAlbumLink}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-cafe-700 rounded-xl hover:bg-cafe-50 transition-colors"
                >
                  <Link2 size={16} className="text-cafe-500" />
                  {isCopied ? (
                    <span className="text-cafe-900 font-semibold">Link Copied!</span>
                  ) : (
                    "Copy Album Link"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className="group relative bg-white border border-cafe-100 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md hover:border-cafe-300 transition-all">
      <Link href={href} className="block min-w-0">
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
      </Link>

      <div className="flex items-start justify-between gap-2 min-w-0">
        <Link href={href} className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-bold text-cafe-900 group-hover:text-cafe-700 transition-colors min-w-0">
            <span className="truncate">{name}</span>
            {PrivacyIcon && (
              <PrivacyIcon
                size={15}
                className="text-cafe-400 shrink-0"
                aria-label={`${privacyLevel} album`}
              />
            )}
          </h3>
          <p className="text-cafe-500 text-sm mt-1">{meta}</p>
        </Link>
        {albumMenu}
      </div>
    </div>
  );
}

export default function PlaylistsPage() {
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [albumPrivacy, setAlbumPrivacy] = useState<PrivacyLevel>("private");
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
          privacy_level: albumPrivacy,
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
      setAlbumPrivacy("private");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to create album.";
      setError(message);
    }
  };

  async function handleUpdateAlbumShare(
    albumId: number,
    privacyLevel: PrivacyLevel,
    invitedEmails: string[],
  ) {
    const response = await fetch(`/api/albums/${albumId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privacy_level: privacyLevel,
        invited_emails: invitedEmails,
      }),
    });

    const payload = (await response.json()) as Album & ApiError;
    if (!response.ok) {
      throw new Error(payload.error || "Failed to update album share option.");
    }

    setAlbums((current) =>
      current.map((album) => (album.album_id === albumId ? payload : album)),
    );
  }

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
            privacyLevel={album.privacy_level}
            invitedEmails={album.invited_emails || []}
            albumId={album.album_id}
            onUpdateShare={async (albumId, privacyLevel, invitedEmails) => {
              try {
                await handleUpdateAlbumShare(albumId, privacyLevel, invitedEmails);
              } catch (requestError) {
                const message =
                  requestError instanceof Error
                    ? requestError.message
                    : "Failed to update album share option.";
                setError(message);
                throw requestError;
              }
            }}
          />
        ))}
      </div>

      {/* Create Album Modal */}
      <Modal
        isOpen={isAlbumModalOpen}
        onClose={() => {
          setIsAlbumModalOpen(false);
          setAlbumName("");
          setAlbumPrivacy("private");
        }}
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
          <div>
            <label className="block text-sm font-semibold text-cafe-900 mb-2">Share Option</label>
            <div className="space-y-2">
              {PRIVACY_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                const selected = albumPrivacy === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAlbumPrivacy(value)}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-cafe-500 bg-cafe-50 text-cafe-900"
                        : "border-cafe-200 bg-white text-cafe-700 hover:bg-cafe-50"
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon size={18} className="text-cafe-500 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="block text-xs text-cafe-500">{description}</span>
                      </span>
                    </span>
                    {selected && <Check size={16} className="text-cafe-700 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-cafe-500">
            Songs added to this album will use this share option. You can still change a song individually from its options menu.
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
