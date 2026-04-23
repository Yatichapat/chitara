"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee, ListMusic, LogIn, LogOut } from "lucide-react";
import { useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  // Mock State for User Story: Login via Google, Remaining Quota
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [quota, setQuota] = useState(15); 

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
        {isLoggedIn ? (
          <div className="bg-cafe-50 rounded-xl p-4 shadow-sm border border-cafe-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-cafe-800">Generations Left</span>
              <span className="text-cafe-600 font-bold text-lg">{quota}</span>
            </div>
            {/* Visual Quota Bar */}
            <div className="h-2 w-full bg-cafe-200 rounded-full overflow-hidden mb-4">
              <div 
                className="h-full bg-cafe-600 rounded-full" 
                style={{ width: `${(quota / 20) * 100}%` }}
              ></div>
            </div>
            
            <button 
              onClick={() => setIsLoggedIn(false)}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg text-sm font-medium text-cafe-800 hover:bg-cafe-200 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsLoggedIn(true)}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-cafe-800 text-cafe-50 rounded-xl hover:bg-cafe-900 transition-colors shadow-sm font-medium"
          >
            <LogIn size={18} />
            Continue with Google
          </button>
        )}
      </div>
    </aside>
  );
}
