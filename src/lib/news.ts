export type NewsArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string; // ISO date string e.g. "2026-06-29"
  readTime: number;    // minutes
  author?: string;
  body: string[];      // one string per paragraph
};

// Add new articles here — newest first
export const newsArticles: NewsArticle[] = [];

export function getArticleBySlug(slug: string): NewsArticle | undefined {
  return newsArticles.find((a) => a.slug === slug);
}

export function getRecentArticles(limit = 6): NewsArticle[] {
  return [...newsArticles]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}
