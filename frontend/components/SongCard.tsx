"use client";

import {
  Download,
  Play,
  Pause,
  Trash2,
  MoreVertical,
  Lock,
  Users,
  Globe,
  Link2,
  ChevronRight,
  ChevronLeft,
  Check,
  ListPlus,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SongCardProps {
  title: string;
  genre: string;
  date: string;
  visibility?: "public" | "private" | "invite";
  songId?: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
  albumOptions?: Array<{ album_id: number; name: string }>;
  currentAlbumIds?: number[];
  onUpdateAlbums?: (songId: number, albumIds: number[]) => Promise<void>;
  onDelete?: (songId: number) => Promise<void>;
}

type MenuView = "root" | "share" | "playlist";

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public", icon: Globe },
  { value: "invite", label: "Invitation Only", icon: Users },
  { value: "private", label: "Private", icon: Lock },
] as const;

export default function SongCard({
  title,
  genre,
  date,
  visibility = "private",
  songId,
  isActive = false,
  isPlaying = false,
  onPlay,
  albumOptions = [],
  currentAlbumIds = [],
  onUpdateAlbums,
  onDelete,
}: SongCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>("root");
  const [currentVisibility, setCurrentVisibility] = useState(visibility);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    setSelectedAlbumIds(new Set());
    setTimeout(() => setMenuView("root"), 150);
  }

  function openPlaylistMenu() {
    setSelectedAlbumIds(new Set(currentAlbumIds.map(String)));
    setMenuView("playlist");
  }

  function handleCopyLink() {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "https://chitara.app";
    navigator.clipboard.writeText(`${origin}/share/${songId ?? "demo"}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  function toggleAlbumSelection(albumId: string) {
    setSelectedAlbumIds((prev) => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });
  }

  async function handleUpdateAlbums() {
    if (!songId || !onUpdateAlbums || isMoving) return;
    setIsMoving(true);
    try {
      const nextAlbumIds = Array.from(selectedAlbumIds)
        .map((id) => Number(id))
        .filter((albumId) => Number.isFinite(albumId));
      await onUpdateAlbums(songId, nextAlbumIds);
      closeMenu();
    } finally {
      setIsMoving(false);
    }
  }

  async function handleDeleteSong() {
    if (!songId || !onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(songId);
      closeMenu();
    } finally {
      setIsDeleting(false);
    }
  }

  const VisibilityIcon =
    VISIBILITY_OPTIONS.find((o) => o.value === currentVisibility)?.icon ?? Lock;

  return (
    <div
      className={`group bg-white border rounded-2xl p-4 flex items-center justify-between transition-all ${
        isActive
          ? "border-cafe-300 shadow-md"
          : "border-cafe-100 hover:shadow-md hover:border-cafe-200"
      }`}
    >

      {/* Left: cover + info */}
      <button
        type="button"
        onClick={onPlay}
        className="flex items-center gap-4 min-w-0 text-left"
      >
        <div className="relative w-14 h-14 bg-cafe-100 rounded-xl flex-shrink-0 cursor-pointer overflow-hidden border border-cafe-200">
          <div
            className={`absolute inset-0 bg-cafe-900/20 flex items-center justify-center transition-opacity ${
              isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {isActive && isPlaying ? (
              <Pause size={20} className="text-white fill-white" />
            ) : (
              <Play size={20} className="text-white fill-white" />
            )}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-cafe-900 truncate">
            {title} {isActive && <span className="text-cafe-500">{isPlaying ? "• Playing" : "• Paused"}</span>}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-cafe-500 font-medium">
            <span className="capitalize px-2 py-0.5 bg-cafe-50 rounded border border-cafe-100">
              {genre}
            </span>
            <span>•</span>
            <span>{date}</span>
          </div>
        </div>
      </button>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {/* Download quick action */}
        <button
          className="hidden md:flex p-2 text-cafe-400 hover:text-cafe-800 hover:bg-cafe-50 rounded-full transition-colors"
          title="Download"
        >
          <Download size={18} />
        </button>

        {/* 3-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              setMenuOpen((o) => !o);
              setMenuView("root");
            }}
            className="p-2 text-cafe-400 hover:text-cafe-800 hover:bg-cafe-50 rounded-full transition-colors"
          >
            <MoreVertical size={20} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-cafe-100 rounded-2xl shadow-xl z-50 overflow-hidden">

              {/* ── ROOT VIEW ── */}
              {menuView === "root" && (
                <div className="p-1.5">
                  {/* Share row → go to share submenu */}
                  <button
                    onClick={() => setMenuView("share")}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-cafe-700 rounded-xl hover:bg-cafe-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <VisibilityIcon size={16} className="text-cafe-500" />
                      Share
                    </span>
                    <ChevronRight size={14} className="text-cafe-400" />
                  </button>

                  {/* Move to playlist row */}
                  <button
                    onClick={openPlaylistMenu}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-cafe-700 rounded-xl hover:bg-cafe-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ListPlus size={16} className="text-cafe-500" />
                      Add to Playlists
                    </span>
                    <ChevronRight size={14} className="text-cafe-400" />
                  </button>

                  <div className="my-1 border-t border-cafe-100" />

                  <button
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-cafe-700 rounded-xl hover:bg-cafe-50 transition-colors md:hidden"
                  >
                    <Download size={16} className="text-cafe-500" />
                    Download
                  </button>

                  <button
                    onClick={handleDeleteSong}
                    disabled={!songId || isDeleting}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                    {isDeleting ? "Deleting..." : "Delete Song"}
                  </button>
                </div>
              )}

              {/* ── SHARE VIEW ── */}
              {menuView === "share" && (
                <div className="p-1.5">
                  {/* Back header */}
                  <button
                    onClick={() => setMenuView("root")}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-cafe-500 hover:text-cafe-800 transition-colors mb-1"
                  >
                    <ChevronLeft size={14} />
                    Share options
                  </button>

                  {/* Visibility options */}
                  {VISIBILITY_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setCurrentVisibility(value);
                        // stay open so user can also copy
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-xl hover:bg-cafe-50 transition-colors ${
                        currentVisibility === value
                          ? "text-cafe-900 font-semibold"
                          : "text-cafe-700"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={16} className="text-cafe-500" />
                        {label}
                      </span>
                      {currentVisibility === value && (
                        <Check size={14} className="text-cafe-700" />
                      )}
                    </button>
                  ))}

                  <div className="my-1 border-t border-cafe-100" />

                  {/* Copy link */}
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-cafe-700 rounded-xl hover:bg-cafe-50 transition-colors"
                  >
                    <Link2 size={16} className="text-cafe-500" />
                    {isCopied ? (
                      <span className="text-cafe-900 font-semibold">Link Copied!</span>
                    ) : (
                      "Copy Link"
                    )}
                  </button>
                </div>
              )}

              {/* ── PLAYLIST VIEW ── */}
              {menuView === "playlist" && (
                <div className="p-1.5">
                  {/* Back header */}
                  <button
                    onClick={() => setMenuView("root")}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-cafe-500 hover:text-cafe-800 transition-colors"
                  >
                    <ChevronLeft size={14} />
                    Add to Playlists
                  </button>

                  <div className="my-1 border-t border-cafe-100" />

                  {albumOptions.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-cafe-400 text-center">
                      No playlists available. Create one first.
                    </p>
                  ) : (
                    <>
                      {/* Multi-select styled list */}
                      <div className="max-h-44 overflow-y-auto space-y-0.5 mt-0.5">
                        {albumOptions.map((album) => {
                          const checked = selectedAlbumIds.has(String(album.album_id));
                          return (
                            <button
                              key={album.album_id}
                              onClick={() => toggleAlbumSelection(String(album.album_id))}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-colors ${
                                checked
                                  ? "bg-cafe-100 text-cafe-900 font-semibold"
                                  : "text-cafe-700 hover:bg-cafe-50"
                              }`}
                            >
                              {/* Checkbox */}
                              <span
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  checked
                                    ? "border-cafe-700 bg-cafe-700"
                                    : "border-cafe-300 bg-white"
                                }`}
                              >
                                {checked && (
                                  <Check size={10} className="text-cafe-50" strokeWidth={3} />
                                )}
                              </span>
                              {album.name}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-2 pt-2 border-t border-cafe-100">
                        <button
                          onClick={handleUpdateAlbums}
                          disabled={isMoving}
                          className="w-full py-2 text-sm font-medium rounded-xl bg-cafe-800 text-cafe-50 hover:bg-cafe-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isMoving
                            ? "Saving..."
                            : `Save ${selectedAlbumIds.size} playlist${selectedAlbumIds.size !== 1 ? "s" : ""}`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
