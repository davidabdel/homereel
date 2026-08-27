import Link from "next/link";
import { newsArticles } from "@/lib/news";

const CATEGORIES = ["All", "AI Advertising", "Social Media Ads", "Google Ads", "Industry Trends", "Ad Strategy"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const metadata = {
  title: "News & Insights | HomeReel",
  description:
    "The latest news, analysis, and strategy for AI-powered advertising. Updated daily for performance marketers and e-commerce brands.",
};

export default function NewsPage() {
  const sorted = [...newsArticles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const [featured, ...rest] = sorted;

  return (
    <div className="min-h-screen bg-[#F1EEE3] text-[#131118]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b-[3px] border-[#131118] bg-[#F1EEE3]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-display flex items-baseline gap-0.5 text-[24px]">
              HOME<span className="text-[#6E2CF4]">✱</span>REEL
            </Link>
            <nav className="hidden items-center gap-2 text-sm font-bold uppercase md:flex">
              <Link href="/" className="hover:text-[#6E2CF4]">Home</Link>
              <Link href="/news" className="border-b-2 border-[#131118]">News</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-bold uppercase hover:text-[#6E2CF4]">Login</Link>
            <Link
              href="/register"
              className="inline-block border-[3px] border-[#131118] bg-[#D8FF3E] px-4 py-2 text-sm font-extrabold uppercase shadow-[4px_4px_0_#131118] transition-colors hover:bg-[#6E2CF4] hover:text-[#F1EEE3]"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero banner ── */}
      <div className="border-b-[3px] border-[#131118] bg-[#131118] px-6 py-14 text-[#F1EEE3]">
        <div className="mx-auto max-w-7xl">
          <div className="font-mono-brand mb-4 inline-flex items-center gap-2 border-[3px] border-[#D8FF3E] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#D8FF3E]">
            Updated Daily
          </div>
          <h1 className="font-display leading-[0.95]" style={{ fontSize: "clamp(40px,6vw,80px)" }}>
            AI ADS &amp; PERFORMANCE<br className="hidden sm:block" /> MARKETING NEWS
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#F1EEE3]/70">
            The sharpest analysis on AI creative, paid social, and what&apos;s actually moving the needle — written for brands and marketers who move fast.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* ── Category filter ── */}
        <div className="mb-10 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <span
              key={cat}
              className={`border-[3px] border-[#131118] px-4 py-1.5 text-sm font-bold uppercase ${
                cat === "All" ? "bg-[#D8FF3E]" : "bg-transparent hover:bg-[#D8FF3E]"
              }`}
            >
              {cat}
            </span>
          ))}
        </div>

        {/* ── Featured article ── */}
        {featured && (
          <Link href={`/news/${featured.slug}`} className="group mb-12 block">
            <div className="border-[3px] border-[#131118] bg-[#131118] p-8 text-[#F1EEE3] shadow-[8px_8px_0_#6E2CF4] transition-transform md:p-10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="font-mono-brand border-[2px] border-[#D8FF3E] bg-[#D8FF3E] px-3 py-1 text-xs font-bold uppercase text-[#131118]">
                  Featured
                </span>
                <span className="font-mono-brand border-[2px] border-[#F1EEE3]/40 px-3 py-1 text-xs uppercase text-[#F1EEE3]/60">
                  {featured.category}
                </span>
              </div>
              <h2 className="font-display leading-[0.98] group-hover:text-[#D8FF3E]" style={{ fontSize: "clamp(28px,4vw,48px)" }}>
                {featured.title}
              </h2>
              <p className="mt-3 max-w-3xl text-base text-[#F1EEE3]/70">{featured.excerpt}</p>
              <div className="font-mono-brand mt-6 flex items-center gap-3 text-sm text-[#F1EEE3]/50">
                <span>{featured.author}</span>
                <span>✱</span>
                <span>{formatDate(featured.publishedAt)}</span>
                <span>✱</span>
                <span>{featured.readTime} min read</span>
              </div>
            </div>
          </Link>
        )}

        {/* ── AdSense — top of grid ── */}
        <div className="mb-10 flex justify-center">
          <div className="hidden overflow-hidden border-[3px] border-[#131118] md:block">
            <ins
              className="adsbygoogle"
              style={{ display: "inline-block", width: 728, height: 90 }}
              data-ad-client="ca-pub-3962710606150436"
              data-ad-slot="AUTO"
            />
          </div>
          <div className="overflow-hidden border-[3px] border-[#131118] md:hidden">
            <ins
              className="adsbygoogle"
              style={{ display: "inline-block", width: 320, height: 100 }}
              data-ad-client="ca-pub-3962710606150436"
              data-ad-slot="AUTO"
            />
          </div>
        </div>

        {/* ── Article grid ── */}
        <div className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((article) => (
            <Link
              key={article.slug}
              href={`/news/${article.slug}`}
              className="group flex flex-col border-[3px] border-[#131118] bg-[#F1EEE3] p-6 shadow-[6px_6px_0_#131118] transition-transform hover:-translate-y-0.5"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="font-mono-brand border-[2px] border-[#131118] px-2.5 py-0.5 text-xs font-bold uppercase">
                  {article.category}
                </span>
              </div>
              <h3 className="mb-2 flex-1 text-base font-black leading-snug uppercase group-hover:text-[#6E2CF4]">
                {article.title}
              </h3>
              <p className="mb-4 line-clamp-3 text-sm text-[#131118]/60">{article.excerpt}</p>
              <div className="font-mono-brand mt-auto flex items-center gap-3 text-xs text-[#131118]/50">
                <span>{formatDate(article.publishedAt)}</span>
                <span>✱</span>
                <span>{article.readTime} min</span>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Bottom AdSense ── */}
        <div className="mb-16 flex justify-center">
          <div className="overflow-hidden border-[3px] border-[#131118]">
            <ins
              className="adsbygoogle"
              style={{ display: "inline-block", width: 300, height: 250 }}
              data-ad-client="ca-pub-3962710606150436"
              data-ad-slot="AUTO"
            />
          </div>
        </div>

        {/* ── CTA strip ── */}
        <div className="border-[3px] border-[#131118] bg-[#6E2CF4] p-8 text-center text-[#F1EEE3] md:p-10">
          <h2 className="font-display leading-[0.98]" style={{ fontSize: "clamp(28px,4vw,44px)" }}>
            TURN YOUR PRODUCT INTO SCROLL-STOPPING ADS — IN MINUTES
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[#F1EEE3]/80">
            HomeReel turns the photos already on your listing into a film. No camera, no crew, nothing added.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block border-[3px] border-[#131118] bg-[#D8FF3E] px-8 py-3 text-sm font-extrabold uppercase text-[#131118] shadow-[6px_6px_0_#131118] transition-colors hover:bg-[#F1EEE3]"
          >
            Try HomeReel Free →
          </Link>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t-[3px] border-[#131118] bg-[#131118] px-6 py-10 text-[#F1EEE3]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <Link href="/" className="font-display text-[22px]">
            HOME<span className="text-[#6E2CF4]">✱</span>REEL
          </Link>
          <div className="font-mono-brand flex items-center gap-6 text-sm uppercase text-[#F1EEE3]/60">
            <Link href="/" className="hover:text-[#D8FF3E]">Home</Link>
            <Link href="/news" className="hover:text-[#D8FF3E]">News</Link>
            <Link href="/pricing" className="hover:text-[#D8FF3E]">Pricing</Link>
            <Link href="/login" className="hover:text-[#D8FF3E]">Login</Link>
          </div>
          <p className="font-mono-brand text-xs text-[#F1EEE3]/40">© {new Date().getFullYear()} HOMEREEL</p>
        </div>
      </footer>
    </div>
  );
}
