"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import Modal from "@/components/Modal";
import { getStoredAuthUser, storeAuthUser } from "@/lib/auth";
import { ApiError, GenerateRequest, Song } from "@/lib/types";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Home() {
  const [formData, setFormData] = useState({
    title: "",
    occasion: "",
    genre: "",
    description: "",
    mood: ""
  });

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const successTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsConfirmOpen(true);
  };

  const handleGenerate = async () => {
    setIsConfirmOpen(false);
    setIsGenerating(true);
    setProgress(0);
    setIsSuccess(false);
    setError("");

    const payload: GenerateRequest = {
      prompt: formData.description.trim(),
      title: formData.title.trim(),
      genre: formData.genre.trim(),
      mood: formData.mood.trim(),
      occasion: formData.occasion.trim(),
    };

    const currentUser = getStoredAuthUser();
    if (!currentUser) {
      setIsGenerating(false);
      setError("Please sign in with Google before generating a song.");
      return;
    }

    if (currentUser.generation_quota <= 0) {
      setIsGenerating(false);
      setError("You have no generation credits remaining.");
      return;
    }

    try {
      const generateResponse = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          description: formData.description.trim(),
          creator_id: currentUser.user_id,
        }),
      });

      const generatePayload = (await generateResponse.json()) as Song & ApiError;
      if (!generateResponse.ok) {
        throw new Error(generatePayload.error || "Failed to start song generation.");
      }

      if (typeof generatePayload.creator_generation_quota === "number") {
        storeAuthUser({
          ...currentUser,
          generation_quota: generatePayload.creator_generation_quota,
        });
      }

      let latestSong = generatePayload;
      setProgress(
        latestSong.generation_status === "completed" ? 100 : 20,
      );

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        if (latestSong.generation_status === "completed") {
          break;
        }

        if (latestSong.generation_status === "failed") {
          throw new Error("Song generation failed.");
        }

        if (!latestSong.generation_task_id) {
          throw new Error("Generation started but no task ID was returned.");
        }

        await sleep(POLL_INTERVAL_MS);

        const statusResponse = await fetch(`/api/status/${latestSong.generation_task_id}`, {
          cache: "no-store",
        });
        const statusPayload = (await statusResponse.json()) as Song & ApiError;
        if (!statusResponse.ok) {
          throw new Error(statusPayload.error || "Failed to check generation status.");
        }

        latestSong = statusPayload;
        setProgress(Math.min(95, 20 + (attempt + 1) * 8));
      }

      if (latestSong.generation_status !== "completed") {
        throw new Error("Song generation timed out before completion.");
      }

      setProgress(100);
      setIsSuccess(true);
      setFormData({ title: "", occasion: "", genre: "", description: "", mood: "" });

      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }

      successTimeoutRef.current = window.setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unexpected error while generating song.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <header className="mb-10 text-center">
        <h1 className="text-4xl lg:text-5xl font-display font-bold text-cafe-900 mb-4 tracking-tight">Create AI Music</h1>
        <p className="text-cafe-600 text-lg max-w-xl mx-auto">
          Describe the feeling, pick the genre, and let our AI compose a bespoke track for your special occasion.
        </p>
      </header>

      <form onSubmit={handlePreSubmit} className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(66,42,29,0.04)] border border-cafe-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-semibold text-cafe-900 mb-2">Song Title</label>
            <input 
              required
              type="text" 
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Midnight Espresso" 
              className="w-full px-4 py-3 bg-cafe-50 border border-cafe-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cafe-400 focus:border-transparent transition-shadow text-cafe-900 placeholder:text-cafe-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-cafe-900 mb-2">Genre</label>
            <select 
              required
              name="genre"
              value={formData.genre}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-cafe-50 border border-cafe-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cafe-400 text-cafe-900 appearance-none"
            >
              <option value="" disabled>Select a genre...</option>
              <option value="jazz">Jazz / Bossa Nova</option>
              <option value="lofi">Lo-Fi / Chillhop</option>
              <option value="pop">Acoustic Pop</option>
              <option value="classical">Classical Piano</option>
              <option value="ambient">Ambient</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-cafe-900 mb-2">Mood</label>
            <select 
              required
              name="mood"
              value={formData.mood}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-cafe-50 border border-cafe-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cafe-400 text-cafe-900 appearance-none"
            >
              <option value="" disabled>Select a mood...</option>
              <option value="relaxed">Relaxed & Cozy</option>
              <option value="energetic">Energetic & Upbeat</option>
              <option value="melancholic">Melancholic</option>
              <option value="romantic">Romantic</option>
            </select>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-semibold text-cafe-900 mb-2">Occasion</label>
            <input 
              required
              type="text" 
              name="occasion"
              value={formData.occasion}
              onChange={handleChange}
              placeholder="e.g. Studying, Morning Walk, Background Cafe" 
              className="w-full px-4 py-3 bg-cafe-50 border border-cafe-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cafe-400 focus:border-transparent text-cafe-900 placeholder:text-cafe-400"
            />
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-semibold text-cafe-900 mb-2">Detailed Description</label>
            <textarea 
              required
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the instruments, tempo, and general vibe you're looking for..." 
              className="w-full px-4 py-3 bg-cafe-50 border border-cafe-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cafe-400 focus:border-transparent text-cafe-900 placeholder:text-cafe-400 resize-none"
            ></textarea>
          </div>
        </div>

        <button 
          type="submit"
          disabled={isGenerating}
          className="w-full py-4 bg-cafe-800 text-cafe-50 font-bold rounded-xl hover:bg-cafe-900 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Sparkles size={20} />
          Generate Song
        </button>
      </form>

      {error && (
        <div className="mt-6 bg-red-50 p-4 rounded-2xl border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Progress View */}
      {isGenerating && (
        <div className="mt-8 bg-white p-6 rounded-2xl border border-cafe-200 shadow-sm text-center animate-in fade-in slide-in-from-bottom-4">
          <Loader2 className="animate-spin text-cafe-600 mx-auto mb-4" size={32} />
          <h3 className="text-lg font-bold text-cafe-900 mb-2">Composing your masterpiece...</h3>
          <p className="text-cafe-600 text-sm mb-4">Connecting to AI engine and generating stems</p>
          
          <div className="w-full bg-cafe-100 rounded-full h-2.5 overflow-hidden">
            <div className="bg-cafe-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* Success View */}
      {isSuccess && (
        <div className="mt-8 bg-green-50 p-6 rounded-2xl border border-green-200 text-center animate-in fade-in slide-in-from-bottom-4 flex flex-col items-center">
          <CheckCircle2 className="text-green-600 mb-2" size={36} />
          <h3 className="text-lg font-bold text-green-900">Song Generated Successfully!</h3>
          <p className="text-green-700 text-sm mt-1">Saved automatically to your Library.</p>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)}
        title="Confirm Generation"
      >
        <div className="space-y-4">
          <p className="text-cafe-700 text-sm">
            Are you sure you want to generate <strong>&quot;{formData.title || "Untitled"}&quot;</strong>? 
            This will consume <strong>1 generation credit</strong> from your quota.
          </p>
          
          <div className="bg-cafe-50 p-4 rounded-xl text-sm space-y-2 border border-cafe-100">
            <div className="flex text-cafe-800"><span className="w-24 text-cafe-500 font-medium">Genre:</span> <span className="capitalize">{formData.genre}</span></div>
            <div className="flex text-cafe-800"><span className="w-24 text-cafe-500 font-medium">Mood:</span> <span className="capitalize">{formData.mood}</span></div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="flex-1 py-2.5 rounded-xl font-medium text-cafe-700 hover:bg-cafe-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 py-2.5 rounded-xl font-medium bg-cafe-800 text-cafe-50 hover:bg-cafe-900 transition-colors"
            >
              Confirm & Generate
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
