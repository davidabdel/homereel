"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { getUserCredits } from "@/lib/subscription-service";

const nav = [
  { href: "/app", label: "Home" },
  { href: "/app/create", label: "New Film" },
  { href: "/app/projects", label: "My Films" },
  { href: "/app/subscription", label: "Credits" },
  { href: "/app/profile", label: "Profile" },
];

/**
 * Lets the whole app be clicked through locally with no Supabase, Stripe or
 * KIE credentials. Set NEXT_PUBLIC_DEMO=1 in .env.local. Never enable in prod.
 */
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export default function AppLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  
  useEffect(() => {
    if (DEMO) return;
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);
  
  useEffect(() => {
    async function loadCredits() {
      if (DEMO) { setCredits(1000); return; }
      if (!user) return;
      
      setIsLoadingCredits(true);
      try {
        const result = await getUserCredits(user.id);
        if (result.success && result.credits) {
          setCredits(result.credits.balance);
        } else {
          // If no credits found, display 0 (they'll be created when visiting subscription page)
          setCredits(0);
        }
      } catch (error) {
        console.error('Error loading credits:', error);
        // On error, still show 0 credits
        setCredits(0);
      } finally {
        setIsLoadingCredits(false);
      }
    }
    
    loadCredits();
  }, [user]);
  
  if (isLoading && !DEMO) {
    return <LoadingScreen />;
  }
  return (
    <div className="min-h-screen bg-[#F1EEE3] text-[#131118]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b-[3px] border-[#131118] bg-[#F1EEE3]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-display flex items-baseline gap-0.5 text-[24px]">
              HOME<span className="text-[#6E2CF4]">✱</span>REEL
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/app/subscription"
              className="font-mono-brand border-[3px] border-[#131118] bg-[#D8FF3E] px-3 py-1.5 text-xs font-bold uppercase shadow-[3px_3px_0_#131118] transition-transform active:translate-x-[2px] active:translate-y-[2px]"
            >
              {isLoadingCredits ? '...' : credits !== null ? `${credits} credits` : 'Credits'}
            </Link>
            <div className="relative group">
              <button className="flex h-9 w-9 items-center justify-center border-[3px] border-[#131118] bg-[#F1EEE3] font-bold" aria-label="Account">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </button>
              <div className="invisible absolute right-0 top-full mt-2 w-48 origin-top-right border-[3px] border-[#131118] bg-[#F1EEE3] opacity-0 shadow-[6px_6px_0_#131118] transition-all duration-150 group-hover:visible group-hover:opacity-100">
                <div className="p-3 text-sm">
                  <div className="font-bold">{user?.user_metadata?.name || 'User'}</div>
                  <div className="truncate text-xs text-[#131118]/60">{user?.email}</div>
                </div>
                <div className="border-t-[3px] border-[#131118]">
                  <Link
                    href="/app/profile"
                    className="block w-full px-4 py-2 text-left text-sm font-medium hover:bg-[#D8FF3E]"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-[#D8FF3E]"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 px-4 py-6 md:grid-cols-[240px_1fr] md:gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block">
          <div className="glass-card sticky top-[84px] !p-3">
            <nav className="space-y-1 text-sm font-bold uppercase tracking-[0.02em]">
              {nav.map((n) => {
                const active = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`flex items-center justify-between border-[3px] px-3 py-2.5 transition ${
                      active
                        ? "border-[#131118] bg-[#D8FF3E] shadow-[3px_3px_0_#131118]"
                        : "border-transparent hover:border-[#131118]"
                    }`}
                  >
                    <span>{n.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main>{children}</main>
      </div>
    </div>
  );
}
