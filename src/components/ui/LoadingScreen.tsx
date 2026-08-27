"use client"

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[color:var(--surface)] z-50">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 rounded-full border-4 border-t-[color:var(--brand)] border-r-transparent border-b-[color:var(--brand-2)] border-l-transparent animate-spin"></div>
        <p className="mt-4 text-white/80">Loading...</p>
      </div>
    </div>
  )
}
