"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Coffee, ListMusic, LogIn, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  clearAuthUser,
  consumeGoogleAuthCallback,
  getStoredAuthUser,
  storeAuthUser,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authError, setAuthError] = useState("");

  const isLoggedIn = Boolean(user);
  const quota = user?.generation_quota ?? 0;
  const quotaPercent = useMemo(() => Math.min(100, Math.max(0, (quota / 20) * 100)), [quota]);

  useEffect(() => {
    const storedUser = getStoredAuthUser();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  useEffect(() => {
    const callbackUser = consumeGoogleAuthCallback(searchParams);
    if (callbackUser) {
      setUser(callbackUser);
      storeAuthUser(callbackUser);
      setAuthError("");
      router.replace(pathname);
      return;
    }

    if (searchParams.get("google_auth") === "error") {
      const errorMessage = searchParams.get("error") || "Google sign-in failed.";
      setAuthError(errorMessage);
      router.replace(pathname);
    }
  }, [pathname, router, searchParams]);

  function handleGoogleLogin() {
    if (isRedirecting) {
      return;
    }

    setIsRedirecting(true);
    setAuthError("");

    if (typeof window === "undefined") {
      setIsRedirecting(false);
      setAuthError("Google sign-in is only available in browser.");
      return;
    }

    const nextPath = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/auth/google/redirect?next=${encodeURIComponent(nextPath)}`);
  }

  function handleSignOut() {
    setUser(null);
    setAuthError("");
    clearAuthUser();
  }

  const navItems = [
    { name: "Generate", href: "/", icon: Coffee },
    { name: "Playlists", href: "/playlist", icon: ListMusic },
  ];

  return (
    <aside className="w-64 bg-cafe-100 border-r border-cafe-200 flex flex-col h-full shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-display font-bold text-cafe-900 tracking-wider flex items-center gap-2">
          <Coffee size={24} className="text-cafe-600" />
          Chitara
        </h1>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive
                  ? "bg-cafe-200 text-cafe-900 font-semibold"
                  : "text-cafe-700 hover:bg-cafe-50 hover:text-cafe-900"
              }`}
            >
              <item.icon size={20} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Actions & Quota */}
      <div className="p-4 border-t border-cafe-200">
        {authError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {authError}
          </div>
        )}

        {isLoggedIn ? (
          <div className="bg-cafe-50 rounded-xl p-4 shadow-sm border border-cafe-200">
            <div className="mb-3">
              <p className="text-sm font-semibold text-cafe-800 truncate">{user?.name}</p>
              <p className="text-xs text-cafe-500 truncate">{user?.email}</p>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-cafe-800">Generations Left</span>
              <span className="text-cafe-600 font-bold text-lg">{quota}</span>
            </div>
            {/* Visual Quota Bar */}
            <div className="h-2 w-full bg-cafe-200 rounded-full overflow-hidden mb-4">
              <div 
                className="h-full bg-cafe-600 rounded-full" 
                style={{ width: `${quotaPercent}%` }}
              ></div>
            </div>
            
            <button 
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg text-sm font-medium text-cafe-800 hover:bg-cafe-200 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        ) : (
          <button 
            onClick={handleGoogleLogin}
            disabled={isRedirecting}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-cafe-800 text-cafe-50 rounded-xl hover:bg-cafe-900 transition-colors shadow-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <LogIn size={18} />
            {isRedirecting ? "Redirecting..." : "Continue with Google"}
          </button>
        )}
      </div>
    </aside>
  );
}
