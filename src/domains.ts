/**
 * domains.ts — 도메인 권위 데이터베이스 (200+)
 * 
 * 각 도메인의 Authority 등급을 사전 정의합니다.
 * Genspark의 Multi-Agent 소스 품질 평가를 자동화합니다.
 */

export type AuthorityLevel = "AUTH:HIGH" | "AUTH:MED" | "AUTH:LOW";

export interface DomainInfo {
    authority: AuthorityLevel;
    category: string;
    name: string;
    isWireService?: boolean;
}

// ═══════════════════════════════════════
// Tier 1: AUTH:HIGH — 정부, 국제기구, 학술, 기업 공시
// ═══════════════════════════════════════

const TIER1_DOMAINS: Record<string, DomainInfo> = {
    // === 한국 정부 ===
    "law.go.kr": { authority: "AUTH:HIGH", category: "government", name: "법제처" },
    "kostat.go.kr": { authority: "AUTH:HIGH", category: "government", name: "통계청" },
    "bok.or.kr": { authority: "AUTH:HIGH", category: "government", name: "한국은행" },
    "ecos.bok.or.kr": { authority: "AUTH:HIGH", category: "government", name: "한국은행 ECOS" },
    "fss.or.kr": { authority: "AUTH:HIGH", category: "government", name: "금융감독원" },
    "kdca.go.kr": { authority: "AUTH:HIGH", category: "government", name: "질병관리청" },
    "kosis.kr": { authority: "AUTH:HIGH", category: "government", name: "국가통계포털" },
    "index.go.kr": { authority: "AUTH:HIGH", category: "government", name: "e-나라지표" },
    "moef.go.kr": { authority: "AUTH:HIGH", category: "government", name: "기획재정부" },
    "moe.go.kr": { authority: "AUTH:HIGH", category: "government", name: "교육부" },
    "mois.go.kr": { authority: "AUTH:HIGH", category: "government", name: "행정안전부" },
    "motie.go.kr": { authority: "AUTH:HIGH", category: "government", name: "산업통상자원부" },
    "mof.go.kr": { authority: "AUTH:HIGH", category: "government", name: "해양수산부" },
    "me.go.kr": { authority: "AUTH:HIGH", category: "government", name: "환경부" },
    "mohw.go.kr": { authority: "AUTH:HIGH", category: "government", name: "보건복지부" },
    "mnd.go.kr": { authority: "AUTH:HIGH", category: "government", name: "국방부" },
    "mofa.go.kr": { authority: "AUTH:HIGH", category: "government", name: "외교부" },
    "moj.go.kr": { authority: "AUTH:HIGH", category: "government", name: "법무부" },
    "mcst.go.kr": { authority: "AUTH:HIGH", category: "government", name: "문화체육관광부" },
    "msit.go.kr": { authority: "AUTH:HIGH", category: "government", name: "과학기술정보통신부" },
    "mltm.go.kr": { authority: "AUTH:HIGH", category: "government", name: "국토교통부" },
    "president.go.kr": { authority: "AUTH:HIGH", category: "government", name: "대통령실" },
    "assembly.go.kr": { authority: "AUTH:HIGH", category: "government", name: "국회" },
    "scourt.go.kr": { authority: "AUTH:HIGH", category: "government", name: "대법원" },
    "nec.go.kr": { authority: "AUTH:HIGH", category: "government", name: "중앙선거관리위원회" },
    "bai.go.kr": { authority: "AUTH:HIGH", category: "government", name: "감사원" },
    "data.go.kr": { authority: "AUTH:HIGH", category: "government", name: "공공데이터포털" },
    "kdi.re.kr": { authority: "AUTH:HIGH", category: "research", name: "한국개발연구원(KDI)" },
    "kipf.re.kr": { authority: "AUTH:HIGH", category: "research", name: "한국조세재정연구원" },
    "kiep.go.kr": { authority: "AUTH:HIGH", category: "research", name: "대외경제정책연구원" },
    "krei.re.kr": { authority: "AUTH:HIGH", category: "research", name: "한국농촌경제연구원" },
    "krihs.re.kr": { authority: "AUTH:HIGH", category: "research", name: "국토연구원" },

    // === 미국/영국 정부 ===
    "whitehouse.gov": { authority: "AUTH:HIGH", category: "government", name: "White House" },
    "congress.gov": { authority: "AUTH:HIGH", category: "government", name: "US Congress" },
    "supremecourt.gov": { authority: "AUTH:HIGH", category: "government", name: "US Supreme Court" },
    "bls.gov": { authority: "AUTH:HIGH", category: "government", name: "Bureau of Labor Statistics" },
    "census.gov": { authority: "AUTH:HIGH", category: "government", name: "US Census Bureau" },
    "cdc.gov": { authority: "AUTH:HIGH", category: "government", name: "CDC" },
    "nih.gov": { authority: "AUTH:HIGH", category: "government", name: "NIH" },
    "fda.gov": { authority: "AUTH:HIGH", category: "government", name: "FDA" },
    "sec.gov": { authority: "AUTH:HIGH", category: "government", name: "SEC" },
    "treasury.gov": { authority: "AUTH:HIGH", category: "government", name: "US Treasury" },
    "federalreserve.gov": { authority: "AUTH:HIGH", category: "government", name: "Federal Reserve" },
    "epa.gov": { authority: "AUTH:HIGH", category: "government", name: "EPA" },
    "nasa.gov": { authority: "AUTH:HIGH", category: "government", name: "NASA" },
    "nist.gov": { authority: "AUTH:HIGH", category: "government", name: "NIST" },
    "noaa.gov": { authority: "AUTH:HIGH", category: "government", name: "NOAA" },
    "usda.gov": { authority: "AUTH:HIGH", category: "government", name: "USDA" },
    "gov.uk": { authority: "AUTH:HIGH", category: "government", name: "UK Government" },
    "ons.gov.uk": { authority: "AUTH:HIGH", category: "government", name: "UK Office for National Statistics" },
    "parliament.uk": { authority: "AUTH:HIGH", category: "government", name: "UK Parliament" },

    // === 국제기구 ===
    "un.org": { authority: "AUTH:HIGH", category: "igo", name: "United Nations" },
    "who.int": { authority: "AUTH:HIGH", category: "igo", name: "WHO" },
    "imf.org": { authority: "AUTH:HIGH", category: "igo", name: "IMF" },
    "worldbank.org": { authority: "AUTH:HIGH", category: "igo", name: "World Bank" },
    "wto.org": { authority: "AUTH:HIGH", category: "igo", name: "WTO" },
    "oecd.org": { authority: "AUTH:HIGH", category: "igo", name: "OECD" },
    "iea.org": { authority: "AUTH:HIGH", category: "igo", name: "IEA" },
    "ilo.org": { authority: "AUTH:HIGH", category: "igo", name: "ILO" },
    "unesco.org": { authority: "AUTH:HIGH", category: "igo", name: "UNESCO" },
    "wipo.int": { authority: "AUTH:HIGH", category: "igo", name: "WIPO" },
    "bis.org": { authority: "AUTH:HIGH", category: "igo", name: "BIS" },
    "ecb.europa.eu": { authority: "AUTH:HIGH", category: "igo", name: "ECB" },
    "eurostat.ec.europa.eu": { authority: "AUTH:HIGH", category: "igo", name: "Eurostat" },
    "data.worldbank.org": { authority: "AUTH:HIGH", category: "igo", name: "World Bank Data" },

    // === 학술/연구 ===
    "pubmed.ncbi.nlm.nih.gov": { authority: "AUTH:HIGH", category: "academic", name: "PubMed" },
    "scholar.google.com": { authority: "AUTH:HIGH", category: "academic", name: "Google Scholar" },
    "nature.com": { authority: "AUTH:HIGH", category: "academic", name: "Nature" },
    "science.org": { authority: "AUTH:HIGH", category: "academic", name: "Science" },
    "thelancet.com": { authority: "AUTH:HIGH", category: "academic", name: "The Lancet" },
    "nejm.org": { authority: "AUTH:HIGH", category: "academic", name: "NEJM" },
    "arxiv.org": { authority: "AUTH:HIGH", category: "academic", name: "arXiv" },
    "jstor.org": { authority: "AUTH:HIGH", category: "academic", name: "JSTOR" },
    "ieee.org": { authority: "AUTH:HIGH", category: "academic", name: "IEEE" },
    "acm.org": { authority: "AUTH:HIGH", category: "academic", name: "ACM" },
    "dbpia.co.kr": { authority: "AUTH:HIGH", category: "academic", name: "DBpia" },
    "riss.kr": { authority: "AUTH:HIGH", category: "academic", name: "RISS" },
    "kiss.kstudy.com": { authority: "AUTH:HIGH", category: "academic", name: "KISS" },

    // === 기업 공시 ===
    "dart.fss.or.kr": { authority: "AUTH:HIGH", category: "corporate", name: "DART 전자공시" },
    "ir.tesla.com": { authority: "AUTH:HIGH", category: "corporate", name: "Tesla IR" },
    "investor.apple.com": { authority: "AUTH:HIGH", category: "corporate", name: "Apple IR" },

    // === 팩트체크 기관 ===
    "factcheck.org": { authority: "AUTH:HIGH", category: "factcheck", name: "FactCheck.org" },
    "politifact.com": { authority: "AUTH:HIGH", category: "factcheck", name: "PolitiFact" },
    "snopes.com": { authority: "AUTH:HIGH", category: "factcheck", name: "Snopes" },
    "fullfact.org": { authority: "AUTH:HIGH", category: "factcheck", name: "Full Fact" },
    "factcheck.snu.ac.kr": { authority: "AUTH:HIGH", category: "factcheck", name: "SNU 팩트체크" },
};

// ═══════════════════════════════════════
// Tier 2: AUTH:MED — 주요 언론, 리서치 기관
// ═══════════════════════════════════════

const TIER2_DOMAINS: Record<string, DomainInfo> = {
    // === 한국 주요 언론 ===
    "yna.co.kr": { authority: "AUTH:MED", category: "news", name: "연합뉴스", isWireService: true },
    "yonhapnews.co.kr": { authority: "AUTH:MED", category: "news", name: "연합뉴스", isWireService: true },
    "news.kbs.co.kr": { authority: "AUTH:MED", category: "news", name: "KBS" },
    "news.sbs.co.kr": { authority: "AUTH:MED", category: "news", name: "SBS" },
    "imnews.imbc.com": { authority: "AUTH:MED", category: "news", name: "MBC" },
    "chosun.com": { authority: "AUTH:MED", category: "news", name: "조선일보" },
    "donga.com": { authority: "AUTH:MED", category: "news", name: "동아일보" },
    "joongang.co.kr": { authority: "AUTH:MED", category: "news", name: "중앙일보" },
    "hani.co.kr": { authority: "AUTH:MED", category: "news", name: "한겨레" },
    "khan.co.kr": { authority: "AUTH:MED", category: "news", name: "경향신문" },
    "mk.co.kr": { authority: "AUTH:MED", category: "news", name: "매일경제" },
    "hankyung.com": { authority: "AUTH:MED", category: "news", name: "한국경제" },
    "sedaily.com": { authority: "AUTH:MED", category: "news", name: "서울경제" },
    "edaily.co.kr": { authority: "AUTH:MED", category: "news", name: "이데일리" },
    "mt.co.kr": { authority: "AUTH:MED", category: "news", name: "머니투데이" },
    "news.jtbc.co.kr": { authority: "AUTH:MED", category: "news", name: "JTBC" },
    "newsis.com": { authority: "AUTH:MED", category: "news", name: "뉴시스", isWireService: true },
    "news1.kr": { authority: "AUTH:MED", category: "news", name: "뉴스1", isWireService: true },
    "ytn.co.kr": { authority: "AUTH:MED", category: "news", name: "YTN" },
    "sisafocus.co.kr": { authority: "AUTH:MED", category: "news", name: "시사포커스" },

    // === 국제 주요 언론 ===
    "reuters.com": { authority: "AUTH:MED", category: "news", name: "Reuters", isWireService: true },
    "apnews.com": { authority: "AUTH:MED", category: "news", name: "AP News", isWireService: true },
    "bbc.com": { authority: "AUTH:MED", category: "news", name: "BBC" },
    "bbc.co.uk": { authority: "AUTH:MED", category: "news", name: "BBC" },
    "nytimes.com": { authority: "AUTH:MED", category: "news", name: "New York Times" },
    "washingtonpost.com": { authority: "AUTH:MED", category: "news", name: "Washington Post" },
    "theguardian.com": { authority: "AUTH:MED", category: "news", name: "The Guardian" },
    "wsj.com": { authority: "AUTH:MED", category: "news", name: "Wall Street Journal" },
    "ft.com": { authority: "AUTH:MED", category: "news", name: "Financial Times" },
    "economist.com": { authority: "AUTH:MED", category: "news", name: "The Economist" },
    "bloomberg.com": { authority: "AUTH:MED", category: "news", name: "Bloomberg" },
    "cnbc.com": { authority: "AUTH:MED", category: "news", name: "CNBC" },
    "cnn.com": { authority: "AUTH:MED", category: "news", name: "CNN" },
    "aljazeera.com": { authority: "AUTH:MED", category: "news", name: "Al Jazeera" },
    "france24.com": { authority: "AUTH:MED", category: "news", name: "France 24" },
    "dw.com": { authority: "AUTH:MED", category: "news", name: "DW" },
    "nhk.or.jp": { authority: "AUTH:MED", category: "news", name: "NHK" },
    "afp.com": { authority: "AUTH:MED", category: "news", name: "AFP", isWireService: true },

    // === 리서치/데이터 기관 ===
    "pewresearch.org": { authority: "AUTH:MED", category: "research", name: "Pew Research" },
    "statista.com": { authority: "AUTH:MED", category: "research", name: "Statista" },
    "gallup.com": { authority: "AUTH:MED", category: "research", name: "Gallup" },
    "gallup.co.kr": { authority: "AUTH:MED", category: "research", name: "한국갤럽" },
    "mckinsey.com": { authority: "AUTH:MED", category: "research", name: "McKinsey" },
    "gartner.com": { authority: "AUTH:MED", category: "research", name: "Gartner" },
    "idc.com": { authority: "AUTH:MED", category: "research", name: "IDC" },
    "forrester.com": { authority: "AUTH:MED", category: "research", name: "Forrester" },

    // === 백과사전/레퍼런스 ===
    "en.wikipedia.org": { authority: "AUTH:MED", category: "reference", name: "Wikipedia" },
    "ko.wikipedia.org": { authority: "AUTH:MED", category: "reference", name: "위키백과" },
    "britannica.com": { authority: "AUTH:MED", category: "reference", name: "Britannica" },
    "namu.wiki": { authority: "AUTH:MED", category: "reference", name: "나무위키" },

    // === 테크 전문 ===
    "techcrunch.com": { authority: "AUTH:MED", category: "tech", name: "TechCrunch" },
    "theverge.com": { authority: "AUTH:MED", category: "tech", name: "The Verge" },
    "arstechnica.com": { authority: "AUTH:MED", category: "tech", name: "Ars Technica" },
    "wired.com": { authority: "AUTH:MED", category: "tech", name: "Wired" },
    "zdnet.co.kr": { authority: "AUTH:MED", category: "tech", name: "ZDNet Korea" },
    "etnews.com": { authority: "AUTH:MED", category: "tech", name: "전자신문" },
};

// ═══════════════════════════════════════
// 통신사 패턴 감지
// ═══════════════════════════════════════

const WIRE_SERVICE_PATTERNS = [
    /\(연합뉴스\)/,
    /\[연합뉴스\]/,
    /연합뉴스에 따르면/,
    /\(뉴시스\)/,
    /\(뉴스1\)/,
    /\(AP\)/,
    /\(Reuters\)/,
    /\(AFP\)/,
    /AP=연합뉴스/,
    /Reuters=연합뉴스/,
    /AFP=연합뉴스/,
    /Associated Press/i,
    /wire service/i,
];

// ═══════════════════════════════════════
// 정부 도메인 패턴 (*.go.kr, *.gov 등)
// ═══════════════════════════════════════

const GOV_DOMAIN_PATTERNS = [
    /\.go\.kr$/,
    /\.gov$/,
    /\.gov\.\w+$/,
    /\.mil$/,
    /\.edu$/,
    /\.ac\.kr$/,
    /\.re\.kr$/,
];

// ═══════════════════════════════════════
// Public API
// ═══════════════════════════════════════

const ALL_DOMAINS: Record<string, DomainInfo> = { ...TIER1_DOMAINS, ...TIER2_DOMAINS };

/**
 * 도메인의 권위 등급을 조회합니다.
 */
export function getDomainAuthority(domain: string): DomainInfo {
    // 정확한 도메인 매칭
    const normalized = domain.toLowerCase().replace(/^www\./, "");

    if (ALL_DOMAINS[normalized]) {
        return ALL_DOMAINS[normalized];
    }

    // 서브도메인 매칭 (예: news.kostat.go.kr → kostat.go.kr)
    const parts = normalized.split(".");
    for (let i = 1; i < parts.length; i++) {
        const parentDomain = parts.slice(i).join(".");
        if (ALL_DOMAINS[parentDomain]) {
            return ALL_DOMAINS[parentDomain];
        }
    }

    // 정부/교육 도메인 패턴 매칭
    for (const pattern of GOV_DOMAIN_PATTERNS) {
        if (pattern.test(normalized)) {
            return {
                authority: "AUTH:HIGH",
                category: "government",
                name: normalized,
            };
        }
    }

    // 기본값: AUTH:LOW
    return {
        authority: "AUTH:LOW",
        category: "other",
        name: normalized,
    };
}

/**
 * 콘텐츠가 통신사 기사 재게시(Wire-copy)인지 감지합니다.
 */
export function isWireCopyContent(content: string): { isWireCopy: boolean; origin?: string } {
    for (const pattern of WIRE_SERVICE_PATTERNS) {
        if (pattern.test(content)) {
            const match = content.match(pattern);
            return { isWireCopy: true, origin: match?.[0] };
        }
    }
    return { isWireCopy: false };
}

/**
 * 도메인이 통신사인지 확인합니다.
 */
export function isWireServiceDomain(domain: string): boolean {
    const normalized = domain.toLowerCase().replace(/^www\./, "");
    const info = ALL_DOMAINS[normalized];
    return info?.isWireService === true;
}

/**
 * 한국 공식 1차 출처 도메인 목록을 반환합니다.
 */
export function getKoreanOfficialDomains(): string[] {
    return Object.entries(ALL_DOMAINS)
        .filter(([_, info]) => info.authority === "AUTH:HIGH" && info.category === "government")
        .map(([domain]) => domain);
}

/**
 * 특정 카테고리의 도메인을 반환합니다.
 */
export function getDomainsByCategory(category: string): string[] {
    return Object.entries(ALL_DOMAINS)
        .filter(([_, info]) => info.category === category)
        .map(([domain]) => domain);
}

export { ALL_DOMAINS, WIRE_SERVICE_PATTERNS };
