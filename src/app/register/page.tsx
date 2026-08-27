"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const { signUp, googleSignIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    
    // Validate password strength
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }
    
    try {
      const { error } = await signUp(email, password, name);
      if (error) {
        setError(error.message);
      } else {
        setSuccessMessage('Registration successful! Please check your email to confirm your account.');
        // Optionally redirect after a delay
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
    } catch (err: any) {
      setError(err.message || 'An error occurred with Google sign in');
    }
  };
  return (
    <div className="grid min-h-screen bg-[#F1EEE3] text-[#131118] md:grid-cols-2">
      {/* Left: ink marketing panel */}
      <div className="relative hidden overflow-hidden border-r-[3px] border-[#131118] bg-[#131118] text-[#F1EEE3] md:block">
        <div
          className="font-display pointer-events-none absolute -left-[6%] top-[8%] whitespace-nowrap leading-none text-transparent"
          style={{ fontSize: "22vw", WebkitTextStroke: "2px rgba(241,238,227,0.12)" }}
        >
          UNREAL✱
        </div>
        <div className="relative mx-auto flex h-full max-w-xl flex-col justify-center gap-6 px-12 py-16">
          <div className="font-mono-brand text-[13px] font-bold uppercase tracking-[0.1em] text-[#D8FF3E]">Create your account</div>
          <h1 className="font-display leading-[0.95]" style={{ fontSize: "clamp(48px,6vw,90px)" }}>
            JOIN<br />UNREAL<span className="text-[#6E2CF4]">✱</span>ADZ
          </h1>
          <p className="max-w-sm text-[17px] leading-relaxed text-[#F1EEE3]/80">
            One product photo in. Hundreds of scroll-stopping UGC ads out. Your first one is free.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md glass-card !p-8">
          <h2 className="font-display text-[40px] leading-none">CREATE ACCOUNT</h2>
          <p className="mt-2 text-sm font-medium">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[#6E2CF4] hover:underline">Login</Link>
          </p>

          {error && (
            <div className="mt-4 border-[3px] border-[#131118] bg-[#FF3E5F] p-3 text-sm font-semibold text-[#F1EEE3]">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 border-[3px] border-[#131118] bg-[#D8FF3E] p-3 text-sm font-semibold text-[#131118]">
              {successMessage}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="name" className="font-mono-brand text-[12px] font-bold uppercase tracking-[0.08em]">Name</label>
              <input
                id="name"
                type="text"
                required
                placeholder="Jane Doe"
                className="w-full border-[3px] border-[#131118] bg-[#F1EEE3] px-4 py-3 outline-none placeholder:text-[#131118]/40 focus:bg-white focus:shadow-[4px_4px_0_#131118]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="font-mono-brand text-[12px] font-bold uppercase tracking-[0.08em]">Email</label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full border-[3px] border-[#131118] bg-[#F1EEE3] px-4 py-3 outline-none placeholder:text-[#131118]/40 focus:bg-white focus:shadow-[4px_4px_0_#131118]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="font-mono-brand text-[12px] font-bold uppercase tracking-[0.08em]">Password</label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full border-[3px] border-[#131118] bg-[#F1EEE3] px-4 py-3 outline-none placeholder:text-[#131118]/40 focus:bg-white focus:shadow-[4px_4px_0_#131118]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm" className="font-mono-brand text-[12px] font-bold uppercase tracking-[0.08em]">Confirm password</label>
              <input
                id="confirm"
                type="password"
                required
                placeholder="••••••••"
                className="w-full border-[3px] border-[#131118] bg-[#F1EEE3] px-4 py-3 outline-none placeholder:text-[#131118]/40 focus:bg-white focus:shadow-[4px_4px_0_#131118]"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="font-mono-brand my-5 flex items-center gap-3 text-xs font-bold text-[#131118]/50">
            <div className="h-[2px] flex-1 bg-[#131118]/20" /> OR <div className="h-[2px] flex-1 bg-[#131118]/20" />
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="w-full border-[3px] border-[#131118] bg-[#F1EEE3] px-4 py-3 text-sm font-bold uppercase transition-colors hover:bg-[#D8FF3E]"
          >
            Continue with Google
          </button>

          <p className="mt-6 text-[11px] leading-5 text-[#131118]/60">
            By continuing you agree to our <a className="underline" href="#">Terms</a> and <a className="underline" href="#">Privacy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
