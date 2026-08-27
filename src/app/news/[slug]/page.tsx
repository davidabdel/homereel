import Link from "next/link";
import { notFound } from "next/navigation";
import { newsArticles, getArticleBySlug } from "@/lib/news";

export async function generateStaticParams() {
  return newsArticles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: `${article.title} | UnrealAdz News`,
    description: article.excerpt,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Inline AdSense unit (server-safe — push() handled client-side by the global script)
function Ad({
  slot,
  width,
  height,
  className = "",
}: {
  slot: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <div className={`flex justify-center ${className}`} aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: "inline-block", width, height }}
        data-ad-client="ca-pub-3962710606150436"
        data-ad-slot={slot}
      />
    </div>
  );
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  // Split body into: intro (paragraphs 0-1), mid (paragraph 2), rest
  const intro = article.body.slice(0, 2);
  const midBreak = article.body[2];
  const remaining = article.body.slice(3);

  return (
    <div className="min-h-screen bg-[#F1EEE3] text-[#131118]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b-[3px] border-[#131118] bg-[#F1EEE3]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-display flex items-baseline gap-0.5 text-[24px]">
              UNREAL<span className="text-[#6E2CF4]">✱</span>ADZ
            </Link>
            <nav className="hidden items-center gap-2 text-sm font-bold uppercase md:flex">
              <Link href="/" className="hover:text-[#6E2CF4]">Home</Link>
              <Link href="/news" className="hover:text-[#6E2CF4]">News</Link>
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

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Breadcrumb */}
        <nav className="font-mono-brand mb-8 flex items-center gap-2 text-sm text-[#131118]/50">
          <Link href="/" className="hover:text-[#6E2CF4]">Home</Link>
          <span>/</span>
          <Link href="/news" className="hover:text-[#6E2CF4]">News</Link>
          <span>/</span>
          <span className="max-w-xs truncate text-[#131118]/70">{article.title}</span>
        </nav>

        <div className="flex gap-10">
          {/* ── Main content ── */}
          <main className="min-w-0 flex-1">
            {/* Article header */}
            <div className="mb-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="font-mono-brand border-[2px] border-[#131118] px-3 py-1 text-xs font-bold uppercase">
                  {article.category}
                </span>
              </div>
              <h1 className="font-display leading-[0.98]" style={{ fontSize: "clamp(30px,4.5vw,52px)" }}>
                {article.title}
              </h1>
              <div className="font-mono-brand mt-5 flex flex-wrap items-center gap-4 border-b-[3px] border-[#131118] pb-6 text-sm text-[#131118]/50">
                {article.author && <span>{article.author}</span>}
                {article.author && <span>✱</span>}
                <span>{formatDate(article.publishedAt)}</span>
                <span>✱</span>
                <span>{article.readTime} min read</span>
              </div>
            </div>

            {/* AD 1 — Below headline, above body */}
            <div className="mb-8 hidden justify-center overflow-hidden border-[3px] border-[#131118] md:flex">
              <Ad slot="LEADERBOARD_SLOT" width={728} height={90} />
            </div>
            <div className="mb-8 flex justify-center overflow-hidden border-[3px] border-[#131118] md:hidden">
              <Ad slot="MOBILE_BANNER_SLOT" width={320} height={100} />
            </div>

            {/* Article intro (paragraphs 1–2) */}
            <div className="prose prose-lg max-w-none">
              {intro.map((para, i) => (
                <p key={i} className="mb-5 leading-relaxed text-[#131118]/80">{para}</p>
              ))}
            </div>

            {/* AD 2 — Mid-article */}
            <div className="my-8 flex justify-center overflow-hidden border-[3px] border-[#131118]">
              <Ad slot="MID_ARTICLE_SLOT" width={300} height={250} />
            </div>

            {/* Mid paragraph (3rd) */}
            {midBreak && (
              <div className="prose prose-lg max-w-none">
                <p className="mb-5 leading-relaxed text-[#131118]/80">{midBreak}</p>
              </div>
            )}

            {/* Remaining paragraphs */}
            <div className="prose prose-lg max-w-none">
              {remaining.map((para, i) => (
                <p key={i} className="mb-5 leading-relaxed text-[#131118]/80">{para}</p>
              ))}
            </div>

            {/* AD 3 — End of article */}
            <div className="mb-10 mt-10 flex justify-center overflow-hidden border-[3px] border-[#131118]">
              <Ad slot="END_ARTICLE_SLOT" width={336} height={280} />
            </div>

            {/* Back to news */}
            <div className="mb-10">
              <Link href="/news" className="font-mono-brand inline-flex items-center gap-2 text-sm font-bold uppercase text-[#6E2CF4] hover:underline">
                ← Back to News
              </Link>
            </div>

            {/* CTA strip */}
            <div className="border-[3px] border-[#131118] bg-[#6E2CF4] p-8 text-center text-[#F1EEE3]">
              <h2 className="font-display leading-[0.98]" style={{ fontSize: "clamp(22px,3vw,36px)" }}>
                GENERATE SCROLL-STOPPING ADS IN MINUTES
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-[#F1EEE3]/80">
                One product image. Dozens of UGC-style video ad variants. No team required.
              </p>
              <Link
                href="/register"
                className="mt-5 inline-block border-[3px] border-[#131118] bg-[#D8FF3E] px-7 py-2.5 text-sm font-extrabold uppercase text-[#131118] shadow-[6px_6px_0_#131118] transition-colors hover:bg-[#F1EEE3]"
              >
                Try UnrealAdz Free →
              </Link>
            </div>
          </main>

          {/* ── Sidebar (desktop only) ── */}
          <aside className="hidden w-[300px] shrink-0 flex-col gap-6 lg:flex">
            <div className="sticky top-24">
              <div className="mb-6 overflow-hidden border-[3px] border-[#131118]">
                <Ad slot="SIDEBAR_SLOT" width={300} height={600} />
              </div>
              <div className="border-[3px] border-[#131118] bg-[#F1EEE3] p-5 shadow-[6px_6px_0_#131118]">
                <h3 className="font-mono-brand mb-4 text-sm font-bold uppercase tracking-[0.1em] text-[#131118]/70">
                  Quick Links
                </h3>
                <ul className="space-y-3">
                  {[
                    { label: "Create an Ad", href: "/app/create" },
                    { label: "Pricing", href: "/pricing" },
                    { label: "All News", href: "/news" },
                    { label: "Sign Up Free", href: "/register" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="flex items-center gap-2 text-sm font-semibold hover:text-[#6E2CF4]">
                        <span className="text-[#6E2CF4]">→</span> {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t-[3px] border-[#131118] bg-[#131118] px-6 py-10 text-[#F1EEE3]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <Link href="/" className="font-display text-[22px]">
            UNREAL<span className="text-[#6E2CF4]">✱</span>ADZ
          </Link>
          <div className="font-mono-brand flex items-center gap-6 text-sm uppercase text-[#F1EEE3]/60">
            <Link href="/" className="hover:text-[#D8FF3E]">Home</Link>
            <Link href="/news" className="hover:text-[#D8FF3E]">News</Link>
            <Link href="/pricing" className="hover:text-[#D8FF3E]">Pricing</Link>
            <Link href="/login" className="hover:text-[#D8FF3E]">Login</Link>
          </div>
          <p className="font-mono-brand text-xs text-[#F1EEE3]/40">© {new Date().getFullYear()} UNREALADZ</p>
        </div>
      </footer>
    </div>
  );
}
