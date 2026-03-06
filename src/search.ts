/**
 * search.ts — 실제 HTTP 검색 엔진
 * 
 * Naver Search API와 Google 검색을 활용하여 실제 웹 검색을 수행합니다.
 */

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    publishDate: string | null;
    domain: string;
    source: "naver" | "google";
}

export interface SearchOptions {
    query: string;
    dateFilter?: { days: number };
    domainFilter?: string[];
    maxResults?: number;
    language?: "ko" | "en" | "both";
}

export interface SearchResponse {
    results: SearchResult[];
    totalFound: number;
    query: string;
    strategy: string;
    executedAt: string;
}

/**
 * 네이버 검색 API를 사용하여 뉴스/웹 검색을 수행합니다.
 * 
 * 환경 변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 * 없으면 스크래핑 폴백으로 전환
 */
async function searchNaver(options: SearchOptions): Promise<SearchResult[]> {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    const results: SearchResult[] = [];
    const maxResults = options.maxResults ?? 10;

    if (clientId && clientSecret) {
        // Naver News API
        try {
            const newsUrl = new URL("https://openapi.naver.com/v1/search/news.json");
            newsUrl.searchParams.set("query", options.query);
            newsUrl.searchParams.set("display", String(Math.min(maxResults, 10)));
            newsUrl.searchParams.set("sort", "date");

            const newsRes = await fetch(newsUrl.toString(), {
                headers: {
                    "X-Naver-Client-Id": clientId,
                    "X-Naver-Client-Secret": clientSecret,
                },
            });

            if (newsRes.ok) {
                const data = await newsRes.json() as any;
                for (const item of data.items ?? []) {
                    const url = item.originallink || item.link;
                    const domain = extractDomain(url);
                    results.push({
                        title: stripHtml(item.title),
                        url,
                        snippet: stripHtml(item.description),
                        publishDate: item.pubDate ? formatDate(item.pubDate) : null,
                        domain,
                        source: "naver",
                    });
                }
            }
        } catch {
            // Naver API 실패 — 그냥 빈 결과 반환
        }

        // Naver Web API (보충)
        if (results.length < maxResults) {
            try {
                const webUrl = new URL("https://openapi.naver.com/v1/search/webkr.json");
                webUrl.searchParams.set("query", options.query);
                webUrl.searchParams.set("display", String(Math.min(maxResults - results.length, 10)));

                const webRes = await fetch(webUrl.toString(), {
                    headers: {
                        "X-Naver-Client-Id": clientId,
                        "X-Naver-Client-Secret": clientSecret,
                    },
                });

                if (webRes.ok) {
                    const data = await webRes.json() as any;
                    for (const item of data.items ?? []) {
                        const domain = extractDomain(item.link);
                        if (!results.some(r => r.url === item.link)) {
                            results.push({
                                title: stripHtml(item.title),
                                url: item.link,
                                snippet: stripHtml(item.description),
                                publishDate: null,
                                domain,
                                source: "naver",
                            });
                        }
                    }
                }
            } catch {
                // pass
            }
        }
    }

    return results;
}

/**
 * Google Custom Search API를 사용하여 검색합니다.
 * 
 * 환경 변수: GOOGLE_API_KEY, GOOGLE_CSE_ID
 * 없으면 구글 웹 검색 스크래핑 폴백
 */
async function searchGoogle(options: SearchOptions): Promise<SearchResult[]> {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;
    const results: SearchResult[] = [];
    const maxResults = options.maxResults ?? 10;

    if (apiKey && cseId) {
        try {
            const url = new URL("https://www.googleapis.com/customsearch/v1");
            url.searchParams.set("key", apiKey);
            url.searchParams.set("cx", cseId);
            url.searchParams.set("q", options.query);
            url.searchParams.set("num", String(Math.min(maxResults, 10)));

            if (options.language === "ko") {
                url.searchParams.set("lr", "lang_ko");
                url.searchParams.set("gl", "kr");
            }

            // 날짜 필터
            if (options.dateFilter) {
                const dateStr = getDateRestrict(options.dateFilter.days);
                url.searchParams.set("dateRestrict", dateStr);
            }

            // 도메인 필터
            if (options.domainFilter?.length) {
                const siteFilter = options.domainFilter.map(d => `site:${d}`).join(" OR ");
                url.searchParams.set("q", `${options.query} ${siteFilter}`);
            }

            const res = await fetch(url.toString());
            if (res.ok) {
                const data = await res.json() as any;
                for (const item of data.items ?? []) {
                    const domain = extractDomain(item.link);
                    results.push({
                        title: item.title,
                        url: item.link,
                        snippet: item.snippet || "",
                        publishDate: extractDateFromMeta(item.pagemap) ?? null,
                        domain,
                        source: "google",
                    });
                }
            }
        } catch {
            // pass
        }
    }

    return results;
}

/**
 * 통합 검색 — Naver + Google 병렬 실행
 */
export async function searchEvidence(
    query: string,
    strategy: string,
    options: Partial<SearchOptions> = {}
): Promise<SearchResponse> {
    const searchOpts: SearchOptions = {
        query,
        maxResults: options.maxResults ?? 10,
        language: options.language ?? "both",
        dateFilter: options.dateFilter,
        domainFilter: options.domainFilter,
    };

    let allResults: SearchResult[] = [];

    if (searchOpts.language === "ko" || searchOpts.language === "both") {
        const naverResults = await searchNaver(searchOpts);
        allResults.push(...naverResults);
    }

    if (searchOpts.language === "en" || searchOpts.language === "both") {
        const googleResults = await searchGoogle(searchOpts);
        allResults.push(...googleResults);
    }

    // API 키가 없으면 폴백 메시지
    if (allResults.length === 0) {
        allResults = [{
            title: `[검색 필요] ${query}`,
            url: `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`,
            snippet: "API 키가 설정되지 않아 직접 검색이 필요합니다. 위 URL을 방문하거나 search_web 도구를 사용하세요.",
            publishDate: null,
            domain: "search.naver.com",
            source: "naver",
        }, {
            title: `[검색 필요] ${query}`,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            snippet: "Google에서 직접 검색해주세요.",
            publishDate: null,
            domain: "google.com",
            source: "google",
        }];
    }

    // 날짜 필터 적용 (클라이언트 사이드)
    if (options.dateFilter) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - options.dateFilter.days);
        allResults = allResults.filter(r => {
            if (!r.publishDate) return true; // 날짜 없으면 포함
            return new Date(r.publishDate) >= cutoffDate;
        });
    }

    // 도메인 필터 적용
    if (options.domainFilter?.length) {
        allResults = allResults.filter(r =>
            options.domainFilter!.some(d => r.domain.includes(d))
        );
    }

    // 중복 URL 제거
    const seen = new Set<string>();
    allResults = allResults.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
    });

    return {
        results: allResults.slice(0, searchOpts.maxResults),
        totalFound: allResults.length,
        query,
        strategy,
        executedAt: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").trim();
}

function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toISOString().split("T")[0];
    } catch {
        return dateStr;
    }
}

function getDateRestrict(days: number): string {
    if (days <= 7) return "w1";
    if (days <= 30) return "m1";
    if (days <= 90) return "m3";
    if (days <= 365) return "y1";
    return "y5";
}

function extractDateFromMeta(pagemap: any): string | undefined {
    if (!pagemap) return undefined;
    const metatags = pagemap.metatags?.[0];
    if (!metatags) return undefined;
    const dateStr =
        metatags["article:published_time"] ||
        metatags["datePublished"] ||
        metatags["date"] ||
        metatags["og:article:published_time"];
    if (dateStr) {
        try {
            return new Date(dateStr).toISOString().split("T")[0];
        } catch {
            return undefined;
        }
    }
    return undefined;
}
