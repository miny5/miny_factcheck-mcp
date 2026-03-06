/**
 * query-generator.ts — 5전략 검색 쿼리 자동 생성
 * 
 * Genspark의 Multi-Agent 검색 전략을 자동화합니다.
 * 각 주장에 대해 5가지 전략의 검색 쿼리를 생성합니다.
 */

import { getKoreanOfficialDomains } from "./domains.js";

export type SearchStrategy = "precision" | "recall" | "primary_source" | "contradiction" | "local_language";
export type ClaimCategory = "NUMBER" | "DATE" | "RANKING" | "CAUSATION" | "ENTITY" | "GENERAL";
export type TemporalClass = "STATIC" | "SLOW_CHANGE" | "FAST_CHANGE";

export interface GeneratedQuery {
    strategy: SearchStrategy;
    query: string;
    language: "ko" | "en";
    dateFilter?: { days: number };
    domainFilter?: string[];
    description: string;
}

/**
 * Devil's Advocate (반증) 검색 키워드
 */
const CONTRADICTION_KEYWORDS = {
    ko: ["아니다", "거짓", "오류", "잘못", "사실이 아니", "틀리다", "반박", "정정", "수정", "논란"],
    en: ["false", "debunked", "misleading", "correction", "not true", "myth", "hoax", "wrong", "inaccurate", "retracted"],
};

/**
 * 시간 분류별 검색 기간
 */
const TEMPORAL_DATE_FILTERS: Record<TemporalClass, number | null> = {
    STATIC: null,       // 기간 무제한
    SLOW_CHANGE: 90,    // 최근 90일
    FAST_CHANGE: 7,     // 최근 7일
};

/**
 * 카테고리별 1차 출처 도메인 힌트
 */
const CATEGORY_PRIMARY_DOMAINS: Record<string, string[]> = {
    economy: ["imf.org", "worldbank.org", "bok.or.kr", "kostat.go.kr", "moef.go.kr", "federalreserve.gov"],
    health: ["who.int", "kdca.go.kr", "cdc.gov", "nih.gov", "thelancet.com", "nejm.org"],
    tech: ["ieee.org", "acm.org", "arxiv.org", "techcrunch.com"],
    law: ["law.go.kr", "scourt.go.kr", "congress.gov", "supremecourt.gov"],
    environment: ["iea.org", "me.go.kr", "epa.gov", "noaa.gov"],
    education: ["moe.go.kr", "kedi.re.kr", "unesco.org"],
    population: ["kostat.go.kr", "census.gov", "un.org"],
    finance: ["fss.or.kr", "dart.fss.or.kr", "sec.gov", "bloomberg.com"],
};

/**
 * 주장에 대한 5전략 검색 쿼리를 생성합니다.
 */
export function generateSearchQueries(
    claim: string,
    category: ClaimCategory,
    temporalClass: TemporalClass,
    topic?: string,
): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];
    const dateFilter = TEMPORAL_DATE_FILTERS[temporalClass];
    const currentYear = new Date().getFullYear();

    // === 전략 1: Precision (정밀 검색) ===
    const precisionQuery = buildPrecisionQuery(claim, temporalClass, currentYear);
    queries.push({
        strategy: "precision",
        query: precisionQuery,
        language: "ko",
        dateFilter: dateFilter ? { days: dateFilter } : undefined,
        description: "원문 + 핵심 키워드 + 날짜 한정어로 정밀 검색",
    });

    // === 전략 2: Recall (확장 검색) ===
    const recallQuery = buildRecallQuery(claim);
    queries.push({
        strategy: "recall",
        query: recallQuery,
        language: "en",
        dateFilter: dateFilter ? { days: dateFilter } : undefined,
        description: "핵심 entity만 추출하여 영문 검색 범위 확대",
    });

    // === 전략 3: Primary Source (1차 출처 직접 검색) ===
    const primaryDomains = getPrimaryDomains(claim, category, topic);
    queries.push({
        strategy: "primary_source",
        query: buildPrimaryQuery(claim),
        language: "ko",
        domainFilter: primaryDomains,
        description: `공식 기관 도메인 직접 검색 (${primaryDomains.slice(0, 3).join(", ")}...)`,
    });

    // === 전략 4: Contradiction / Devil's Advocate (반증 검색) ===
    const contradictionQueries = buildContradictionQueries(claim);
    queries.push({
        strategy: "contradiction",
        query: contradictionQueries.ko,
        language: "ko",
        description: "반대 주장 의도적 검색 (Devil's Advocate) — 한국어",
    });
    queries.push({
        strategy: "contradiction",
        query: contradictionQueries.en,
        language: "en",
        description: "반대 주장 의도적 검색 (Devil's Advocate) — 영어",
    });

    // === 전략 5: Local Language (교차 언어 검색) ===
    const localQuery = buildLocalLanguageQuery(claim);
    queries.push({
        strategy: "local_language",
        query: localQuery,
        language: "en",
        dateFilter: dateFilter ? { days: dateFilter } : undefined,
        description: "동일 주장의 영어 버전으로 교차 언어 검증",
    });

    return queries;
}

// ═══════════════════════════════════════
// 내부 쿼리 빌더
// ═══════════════════════════════════════

/**
 * Precision: 원문에서 핵심 키워드 + 날짜 한정어 추가
 */
function buildPrecisionQuery(claim: string, temporal: TemporalClass, year: number): string {
    // 숫자, 고유명사, 키워드 추출
    const numbers = claim.match(/\d[\d,.]*\s*(%|억|만|조|위|명|달러)?/g) || [];
    const yearStr = temporal !== "STATIC" ? ` ${year}` : "";

    // 핵심 키워드만 남기기 (조사/접속사 제거)
    const cleaned = claim
        .replace(/[은는이가을를의에서로도까지](?=\s|$)/g, "")
        .replace(/[.!?~…]/g, "")
        .trim();

    return `${cleaned}${yearStr}`;
}

/**
 * Recall: 핵심 entity만 추출하여 짧은 영문 쿼리
 */
function buildRecallQuery(claim: string): string {
    // 영어 단어 추출 (이미 있는 경우)
    const englishWords = claim.match(/[A-Za-z][\w.-]*/g) || [];

    // 숫자 추출
    const numbers = claim.match(/\d[\d,.]*(?:\s*%)?/g) || [];

    // 한국어 핵심 명사 (간단한 추출)
    const koreanNouns = claim
        .replace(/[A-Za-z\d,.%]/g, "")
        .replace(/[은는이가을를의에서로도만까지와과에게한다았었했하고있는된될할]/g, " ")
        .split(/\s+/)
        .filter(w => w.length >= 2);

    // 영문으로 변환된 키워드 조합
    const keywords = [...englishWords, ...numbers, ...koreanNouns.slice(0, 3)];
    return keywords.join(" ").trim() || claim.slice(0, 50);
}

/**
 * Primary Source: 1차 출처용 간결한 쿼리
 */
function buildPrimaryQuery(claim: string): string {
    // 숫자와 핵심 명사만 추출
    const core = claim
        .replace(/[은는이가을를의에서로도](?=\s|$)/g, "")
        .replace(/[.!?~…]/g, "")
        .trim();

    return core.slice(0, 80);
}

/**
 * Contradiction: Devil's Advocate 반증 쿼리
 */
function buildContradictionQueries(claim: string): { ko: string; en: string } {
    // 핵심 주제 추출
    const core = claim
        .replace(/[은는이가을를의에서로도만까지](?=\s|$)/g, "")
        .replace(/[.!?~…]/g, "")
        .trim()
        .slice(0, 50);

    // 영어 단어 추출
    const englishParts = claim.match(/[A-Za-z][\w.-]*/g) || [];

    // 한국어 반증 쿼리
    const koContra = CONTRADICTION_KEYWORDS.ko.slice(0, 3).join(" OR ");
    const koQuery = `${core} (${koContra})`;

    // 영어 반증 쿼리
    const enCore = englishParts.length > 0 ? englishParts.join(" ") : core;
    const enContra = CONTRADICTION_KEYWORDS.en.slice(0, 3).join(" OR ");
    const enQuery = `${enCore} (${enContra})`;

    return { ko: koQuery, en: enQuery };
}

/**
 * Local Language: 교차 언어 쿼리
 */
function buildLocalLanguageQuery(claim: string): string {
    // 영어 부분이 있으면 그대로, 없으면 핵심 키워드 영문 변환 시도
    const englishParts = claim.match(/[A-Za-z][\w.-]*/g) || [];
    const numbers = claim.match(/\d[\d,.]*(?:\s*%)?/g) || [];

    if (englishParts.length > 0) {
        return [...englishParts, ...numbers].join(" ");
    }

    // 한국어만 있는 경우: 핵심 키워드 추출
    const koreanNouns = claim
        .replace(/[A-Za-z\d,.%]/g, "")
        .replace(/[은는이가을를의에서로도만까지와과에게한다았었했하고있는된될할]/g, " ")
        .split(/\s+/)
        .filter(w => w.length >= 2)
        .slice(0, 4);

    return koreanNouns.join(" ") + " statistics data";
}

/**
 * 카테고리/주제에 맞는 1차 출처 도메인 선택
 */
function getPrimaryDomains(claim: string, category: ClaimCategory, topic?: string): string[] {
    let domains: string[] = [];

    // 카테고리 기반 도메인
    const topicLower = (topic || claim).toLowerCase();
    for (const [key, doms] of Object.entries(CATEGORY_PRIMARY_DOMAINS)) {
        if (topicLower.includes(key) ||
            (key === "economy" && /gdp|경제|성장률|물가|금리|환율|무역|수출|수입/i.test(topicLower)) ||
            (key === "health" && /건강|의료|질병|감염|백신|사망|코로나|약/i.test(topicLower)) ||
            (key === "tech" && /기술|IT|AI|인공지능|컴퓨터|소프트웨어|반도체/i.test(topicLower)) ||
            (key === "law" && /법|법률|판결|헌법|조례|규제/i.test(topicLower)) ||
            (key === "environment" && /환경|기후|탄소|에너지|재생|태양광/i.test(topicLower)) ||
            (key === "finance" && /금융|주식|시가총액|투자|펀드|상장|기업/i.test(topicLower)) ||
            (key === "population" && /인구|출산|고령화|이민|세대/i.test(topicLower))
        ) {
            domains.push(...doms);
        }
    }

    // 기본 한국 공식 도메인 추가
    if (domains.length < 3) {
        domains.push(...getKoreanOfficialDomains().slice(0, 5));
    }

    // 중복 제거
    return [...new Set(domains)].slice(0, 10);
}

/**
 * 클레임의 카테고리를 자동 분류합니다.
 */
export function classifyClaim(claim: string): { category: ClaimCategory; temporal: TemporalClass } {
    let category: ClaimCategory = "GENERAL";
    let temporal: TemporalClass = "SLOW_CHANGE";

    // 카테고리 분류
    if (/\d[\d,.]*\s*(%|억|만|조|원|달러|billion|million|trillion)/i.test(claim)) {
        category = "NUMBER";
    } else if (/\d{4}\s*년|\d{4}-\d{2}/i.test(claim)) {
        category = "DATE";
    } else if (/\d+\s*위|1등|순위|ranking|top\s*\d/i.test(claim)) {
        category = "RANKING";
    } else if (/(때문|원인|결과|영향|효과|이유|덕분|으로\s*인해)/i.test(claim)) {
        category = "CAUSATION";
    } else if (/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/.test(claim)) {
        category = "ENTITY";
    }

    // 시간 분류
    if (/역사|과학|법칙|정의|이론|발명|발견|탄생|사망|설립/i.test(claim)) {
        temporal = "STATIC";
    } else if (/주가|시가총액|환율|여론조사|실시간|오늘|지금|현재|최근|어제|이번\s*주/i.test(claim)) {
        temporal = "FAST_CHANGE";
    }

    return { category, temporal };
}
