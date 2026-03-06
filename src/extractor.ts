/**
 * extractor.ts — URL 콘텐츠 추출기
 * 
 * cheerio를 사용하여 HTML에서 본문 텍스트, 메타데이터, 핵심 팩트를 추출합니다.
 */

import * as cheerio from "cheerio";

export interface ExtractedContent {
    title: string;
    content: string;
    publishDate: string | null;
    author: string | null;
    domain: string;
    wordCount: number;
    keyFacts: KeyFact[];
    success: boolean;
    error?: string;
}

export interface KeyFact {
    type: "number" | "date" | "entity" | "percentage" | "currency";
    value: string;
    context: string;
}

/**
 * URL에서 본문 콘텐츠를 추출합니다.
 */
export async function extractPageContent(url: string): Promise<ExtractedContent> {
    const domain = extractDomain(url);

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            },
            signal: AbortSignal.timeout(10000), // 10초 타임아웃
        });

        if (!response.ok) {
            return createErrorResult(url, domain, `HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
            return createErrorResult(url, domain, `Unsupported content type: ${contentType}`);
        }

        const html = await response.text();
        return parseHtml(html, url, domain);
    } catch (error: any) {
        return createErrorResult(url, domain, error.message || "Fetch failed");
    }
}

/**
 * HTML을 파싱하여 콘텐츠를 추출합니다.
 */
function parseHtml(html: string, url: string, domain: string): ExtractedContent {
    const $ = cheerio.load(html);

    // 불필요한 요소 제거
    $("script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar, .comment, .comments, .related, .share, .social, noscript, iframe").remove();

    // 제목 추출
    const title = extractTitle($);

    // 발행일 추출
    const publishDate = extractPublishDate($);

    // 저자 추출
    const author = extractAuthor($);

    // 본문 추출
    const content = extractMainContent($);

    // 핵심 팩트 추출
    const keyFacts = extractKeyFacts(content);

    // 글자수
    const wordCount = content.replace(/\s+/g, "").length;

    return {
        title,
        content: content.slice(0, 5000), // 최대 5000자
        publishDate,
        author,
        domain,
        wordCount,
        keyFacts,
        success: true,
    };
}

/**
 * 제목 추출 (여러 소스 우선순위)
 */
function extractTitle($: cheerio.CheerioAPI): string {
    return (
        $('meta[property="og:title"]').attr("content") ||
        $("h1").first().text().trim() ||
        $("title").text().trim() ||
        ""
    ).slice(0, 200);
}

/**
 * 발행일 추출 (여러 메타 태그 우선순위)
 */
function extractPublishDate($: cheerio.CheerioAPI): string | null {
    const dateStr =
        $('meta[property="article:published_time"]').attr("content") ||
        $('meta[name="article:published_time"]').attr("content") ||
        $('meta[property="og:article:published_time"]').attr("content") ||
        $('meta[name="date"]').attr("content") ||
        $('meta[name="pubdate"]').attr("content") ||
        $('meta[name="DC.date"]').attr("content") ||
        $('time[datetime]').first().attr("datetime") ||
        $(".date, .published, .pub-date, .article-date").first().text().trim();

    if (!dateStr) return null;

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split("T")[0];
    } catch {
        return null;
    }
}

/**
 * 저자 추출
 */
function extractAuthor($: cheerio.CheerioAPI): string | null {
    return (
        $('meta[name="author"]').attr("content") ||
        $('meta[property="article:author"]').attr("content") ||
        $(".author, .byline, .writer").first().text().trim() ||
        null
    );
}

/**
 * 본문 콘텐츠 추출
 */
function extractMainContent($: cheerio.CheerioAPI): string {
    // 뉴스/기사 본문 셀렉터 우선순위
    const selectors = [
        "article .body",
        "article .content",
        "article .article-body",
        ".article-content",
        ".article_body",
        ".news_body",
        ".newsct_article",        // 네이버 뉴스
        "#articleBodyContents",    // 네이버 뉴스
        "#newsEndContents",        // 네이버 뉴스
        ".news_end",               // 네이버 뉴스
        "#article-view-content-div", // 미디어오늘 등
        ".post-content",
        ".entry-content",
        "article",
        '[role="main"]',
        "main",
        ".content",
    ];

    for (const selector of selectors) {
        const el = $(selector).first();
        if (el.length) {
            const text = el.text().replace(/\s+/g, " ").trim();
            if (text.length > 100) {
                return text;
            }
        }
    }

    // 폴백: <p> 태그들 합치기
    const paragraphs: string[] = [];
    $("p").each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 20) {
            paragraphs.push(text);
        }
    });

    return paragraphs.join("\n\n") || $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);
}

/**
 * 본문에서 핵심 팩트 (숫자, 날짜, 비율 등)를 추출합니다.
 */
function extractKeyFacts(content: string): KeyFact[] {
    const facts: KeyFact[] = [];
    const contextLength = 50;

    // 숫자 (단위 포함)
    const numberPatterns = [
        /(\d[\d,.]*)\s*(억|만|조|원|달러|달러|%|위|명|개|건|회|배|시간|일|개월|년)/g,
        /(\$[\d,.]+\s*(?:billion|million|trillion)?)/gi,
        /([\d,.]+\s*(?:billion|million|trillion|percent|%))/gi,
    ];

    for (const pattern of numberPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const start = Math.max(0, match.index - contextLength);
            const end = Math.min(content.length, match.index + match[0].length + contextLength);
            facts.push({
                type: match[0].includes("%") || match[0].includes("percent") ? "percentage" :
                    match[0].includes("$") || match[0].includes("원") || match[0].includes("달러") ? "currency" : "number",
                value: match[0].trim(),
                context: content.slice(start, end).trim(),
            });
            if (facts.length >= 20) break; // 최대 20개
        }
        if (facts.length >= 20) break;
    }

    // 날짜 패턴
    const datePatterns = [
        /(\d{4})\s*년\s*(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일)?/g,
        /(\d{4})-(\d{2})-(\d{2})/g,
    ];

    for (const pattern of datePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const start = Math.max(0, match.index - contextLength);
            const end = Math.min(content.length, match.index + match[0].length + contextLength);
            facts.push({
                type: "date",
                value: match[0].trim(),
                context: content.slice(start, end).trim(),
            });
            if (facts.length >= 25) break;
        }
        if (facts.length >= 25) break;
    }

    return facts;
}

function createErrorResult(url: string, domain: string, error: string): ExtractedContent {
    return {
        title: "",
        content: "",
        publishDate: null,
        author: null,
        domain,
        wordCount: 0,
        keyFacts: [],
        success: false,
        error,
    };
}

function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}
