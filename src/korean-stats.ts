/**
 * korean-stats.ts — 한국 공식 통계 API 연동
 * 
 * KOSIS (국가통계포털), BOK (한국은행 ECOS) API를 직접 호출합니다.
 * 
 * 환경 변수:
 * - KOSIS_API_KEY: KOSIS 오픈 API 키
 * - BOK_API_KEY: 한국은행 ECOS API 키
 */

export interface StatResult {
    source: string;
    indicator: string;
    value: string;
    unit: string;
    period: string;
    url: string;
    confidence: "exact" | "approximate" | "search_fallback";
}

export interface KoreanStatsResponse {
    stats: StatResult[];
    searchedApis: string[];
    errors: string[];
}

/**
 * KOSIS 국가통계포털 API 검색
 * 
 * API 문서: https://kosis.kr/openapi/
 */
async function searchKosis(keyword: string): Promise<StatResult[]> {
    const apiKey = process.env.KOSIS_API_KEY;
    if (!apiKey) return [];

    const results: StatResult[] = [];

    try {
        // KOSIS 통계 목록 검색
        const url = new URL("https://kosis.kr/openapi/Param/statisticsParameterData.do");
        url.searchParams.set("method", "getList");
        url.searchParams.set("apiKey", apiKey);
        url.searchParams.set("searchNm", keyword);
        url.searchParams.set("format", "json");
        url.searchParams.set("jsonVD", "Y");

        const response = await fetch(url.toString(), {
            signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
            const data = await response.json() as any;
            if (Array.isArray(data)) {
                for (const item of data.slice(0, 5)) {
                    results.push({
                        source: "KOSIS (국가통계포털)",
                        indicator: item.TBL_NM || item.STAT_NM || keyword,
                        value: item.DT || "데이터 있음",
                        unit: item.UNIT_NM || "",
                        period: item.PRD_DE || item.PRD_SE || "",
                        url: `https://kosis.kr/search/search.do?query=${encodeURIComponent(keyword)}`,
                        confidence: item.DT ? "exact" : "approximate",
                    });
                }
            }
        }
    } catch {
        // KOSIS API 실패 — 무시
    }

    return results;
}

/**
 * 한국은행 ECOS API 검색
 * 
 * API 문서: https://ecos.bok.or.kr/api/
 */
async function searchBok(keyword: string): Promise<StatResult[]> {
    const apiKey = process.env.BOK_API_KEY;
    if (!apiKey) return [];

    const results: StatResult[] = [];

    try {
        // 통계 검색
        const url = `https://ecos.bok.or.kr/api/KeyStatisticList/${apiKey}/json/kr/1/10/`;

        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
            const data = await response.json() as any;
            const items = data?.KeyStatisticList?.row || [];

            for (const item of items) {
                const name = item.KEYSTAT_NAME || "";
                if (name.includes(keyword) || keyword.includes(name.slice(0, 3))) {
                    results.push({
                        source: "한국은행 ECOS",
                        indicator: name,
                        value: item.DATA_VALUE || "",
                        unit: item.UNIT_NAME || "",
                        period: item.CYCLE || "",
                        url: `https://ecos.bok.or.kr/#/SearchStat`,
                        confidence: "exact",
                    });
                }
            }
        }
    } catch {
        // BOK API 실패 — 무시
    }

    return results;
}

/**
 * 폴백: 한국 공식 통계 사이트 검색 URL 제공
 */
function getSearchFallbackUrls(keyword: string): StatResult[] {
    return [
        {
            source: "KOSIS 검색",
            indicator: keyword,
            value: "직접 검색 필요",
            unit: "",
            period: "",
            url: `https://kosis.kr/search/search.do?query=${encodeURIComponent(keyword)}`,
            confidence: "search_fallback",
        },
        {
            source: "e-나라지표 검색",
            indicator: keyword,
            value: "직접 검색 필요",
            unit: "",
            period: "",
            url: `https://www.index.go.kr/search/search.do?query=${encodeURIComponent(keyword)}`,
            confidence: "search_fallback",
        },
        {
            source: "한국은행 ECOS 검색",
            indicator: keyword,
            value: "직접 검색 필요",
            unit: "",
            period: "",
            url: `https://ecos.bok.or.kr/#/SearchStat`,
            confidence: "search_fallback",
        },
    ];
}

/**
 * 한국 공식 통계를 검색합니다.
 * 
 * API 키가 있으면 직접 조회, 없으면 검색 URL 폴백
 */
export async function checkKoreanStats(keyword: string, category?: string): Promise<KoreanStatsResponse> {
    const errors: string[] = [];
    const searchedApis: string[] = [];
    let allResults: StatResult[] = [];

    // KOSIS 검색
    searchedApis.push("KOSIS");
    try {
        const kosisResults = await searchKosis(keyword);
        allResults.push(...kosisResults);
    } catch (e: any) {
        errors.push(`KOSIS: ${e.message}`);
    }

    // BOK 검색 (경제/금융 관련)
    const economicKeywords = ["GDP", "금리", "환율", "물가", "경제", "성장률", "수출", "수입", "무역", "고용", "실업", "소비자물가"];
    const isEconomic = economicKeywords.some(k =>
        keyword.includes(k) || (category || "").includes(k)
    );

    if (isEconomic) {
        searchedApis.push("BOK(ECOS)");
        try {
            const bokResults = await searchBok(keyword);
            allResults.push(...bokResults);
        } catch (e: any) {
            errors.push(`BOK: ${e.message}`);
        }
    }

    // API 결과가 없으면 폴백 URL 제공
    if (allResults.length === 0) {
        allResults = getSearchFallbackUrls(keyword);
        if (!process.env.KOSIS_API_KEY) {
            errors.push("KOSIS_API_KEY가 설정되지 않아 직접 검색 URL을 제공합니다");
        }
        if (isEconomic && !process.env.BOK_API_KEY) {
            errors.push("BOK_API_KEY가 설정되지 않아 직접 검색 URL을 제공합니다");
        }
    }

    return {
        stats: allResults,
        searchedApis,
        errors,
    };
}
