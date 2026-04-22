"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { ApiError, GenerateRequest, Song, SongsResponse } from "@/lib/types";

const defaultForm: GenerateRequest = {
  prompt: "Lo-fi piano and dusty drums for a rainy night drive.",
  title: "Streetlight Echo",
  genre: "Lo-fi",
  mood: "Dreamy",
  occasion: "Night",
};

function normalizeStatus(status: string): "pending" | "processing" | "completed" | "failed" {
  const value = status.toLowerCase();
  if (value.includes("fail") || value === "error") {
    return "failed";
  }
  if (value.includes("success") || value === "completed") {
    return "completed";
  }
  if (value === "pending") {
    return "pending";
  }
  return "processing";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export default function HomePage() {
  const [form, setForm] = useState<GenerateRequest>(defaultForm);
  const [songs, setSongs] = useState<Song[]>([]);
  const [busy, setBusy] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const pendingSongs = useMemo(
    () => songs.filter((song) => ["pending", "processing"].includes(normalizeStatus(song.generation_status))),
    [songs],
  );

  const completedSongs = useMemo(
    () => songs.filter((song) => normalizeStatus(song.generation_status) === "completed"),
    [songs],
  );

  async function loadSongs() {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/songs", { cache: "no-store" });
      const payload = await readJson<SongsResponse & ApiError>(response);
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load songs.");
      }

      const sorted = [...(payload.songs || [])].sort((a, b) => b.song_id - a.song_id);
      setSongs(sorted);
      setNotice(`Loaded ${sorted.length} track(s).`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unexpected error.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function generateSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await readJson<Song & ApiError>(response);
      if (!response.ok) {
        throw new Error(payload.error || "Failed to generate a track.");
      }

      setSongs((current) => [payload, ...current]);
      setNotice("Generation started. We will keep refreshing pending tracks.");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unexpected error.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshPending() {
    const refreshable = pendingSongs.filter((song) => Boolean(song.generation_task_id));
    if (!refreshable.length) {
      setNotice("No pending songs with task IDs right now.");
      return;
    }

    try {
      const updates = await Promise.all(
        refreshable.map(async (song) => {
          const response = await fetch(`/api/status/${song.generation_task_id}`, {
            cache: "no-store",
          });
          const payload = await readJson<Song & ApiError>(response);
          if (!response.ok) {
            throw new Error(payload.error || `Failed to refresh ${song.title}.`);
          }
          return payload;
        }),
      );

      setSongs((current) =>
        current.map((song) => updates.find((update) => update.song_id === song.song_id) || song),
      );
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unexpected error.";
      setError(message);
    }
  }

  useEffect(() => {
    loadSongs();
  }, []);

  useEffect(() => {
    if (!pollingEnabled || !pendingSongs.length) {
      return;
    }

    const timer = setInterval(() => {
      void refreshPending();
    }, 12000);

    return () => clearInterval(timer);
  }, [pollingEnabled, pendingSongs.length]);

  return (
    <main className="page">
      <div className="aurora" />

      <header className="hero card">
        <p className="eyebrow">Chitara Studio</p>
        <h1>Turn prompts into playable songs.</h1>
        <p className="subtext">
          Generate tracks, monitor processing, and listen to completed audio in one focused workspace.
        </p>

        <div className="stats">
          <article>
            <p className="statLabel">Library</p>
            <p className="statValue">{songs.length}</p>
          </article>
          <article>
            <p className="statLabel">Pending</p>
            <p className="statValue">{pendingSongs.length}</p>
          </article>
          <article>
            <p className="statLabel">Completed</p>
            <p className="statValue">{completedSongs.length}</p>
          </article>
        </div>
      </header>

      <div className="layoutGrid">
        <section className="card panel">
          <div className="panelHead">
            <h2>Create Track</h2>
            <button
              className={`chip ${pollingEnabled ? "on" : "off"}`}
              onClick={() => setPollingEnabled((value) => !value)}
              type="button"
            >
              Auto Refresh: {pollingEnabled ? "On" : "Off"}
            </button>
          </div>

          <form className="form" onSubmit={generateSong}>
            <label>
              Prompt
              <textarea
                required
                value={form.prompt}
                onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
              />
            </label>

            <div className="row">
              <label>
                Title
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label>
                Occasion
                <input
                  value={form.occasion || ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, occasion: event.target.value }))}
                />
              </label>
            </div>

            <div className="row">
              <label>
                Genre
                <input
                  required
                  value={form.genre}
                  onChange={(event) => setForm((prev) => ({ ...prev, genre: event.target.value }))}
                />
              </label>
              <label>
                Mood
                <input
                  required
                  value={form.mood}
                  onChange={(event) => setForm((prev) => ({ ...prev, mood: event.target.value }))}
                />
              </label>
            </div>

            <div className="actions">
              <button className="primary" disabled={busy} type="submit">
                {busy ? "Working..." : "Generate Song"}
              </button>
              <button className="secondary" disabled={busy} onClick={loadSongs} type="button">
                Reload Library
              </button>
              <button className="secondary" disabled={busy} onClick={refreshPending} type="button">
                Refresh Pending
              </button>
            </div>
          </form>

          {notice ? <p className="feedback ok">{notice}</p> : null}
          {error ? <p className="feedback error">{error}</p> : null}
        </section>

        <section className="card panel">
          <div className="panelHead">
            <h2>Library</h2>
            <p className="muted">Latest first</p>
          </div>

          <div className="songList">
            {!songs.length ? <p className="muted">No songs found. Generate one to begin.</p> : null}

            {songs.map((song) => {
              const status = normalizeStatus(song.generation_status);

              return (
                <article className="songCard" key={song.song_id}>
                  <div className="songTop">
                    <div>
                      <h3>{song.title}</h3>
                      <p className="muted">
                        {song.genre} / {song.mood} / {song.occasion || "General"}
                      </p>
                    </div>
                    <span className={`badge ${status}`}>{song.generation_status}</span>
                  </div>

                  <p className="muted">Created {formatDate(song.created_date)}</p>
                  {song.generation_task_id ? <p className="muted">Task ID: {song.generation_task_id}</p> : null}
                  <p className="description">{song.description}</p>

                  {song.audio_file_path ? (
                    <audio controls preload="none" src={song.audio_file_path} />
                  ) : (
                    <p className="muted">Audio is not available yet.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
