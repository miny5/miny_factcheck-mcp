#!/usr/bin/env node

/**
 * miny_factcheck-mcp v1.0.0
 *
 * Genspark 수준 고퀄리티 팩트체크 MCP 서버
 * 
 * 8개 Tool:
 * 1. generate_search_queries  — 5전략 검색 쿼리 자동 생성
 * 2. search_evidence          — 실제 HTTP 웹 검색
 * 3. extract_page_content     — URL 본문 추출 (cheerio)
 * 4. score_source_quality     — 3차원 소스 품질 채점
 * 5. check_korean_stats       — 한국 공식 통계 API
 * 6. detect_duplicates        — Wire-copy + 중복 감지
 * 7. calculate_confidence     — 수학적 신뢰도 계산
 * 8. format_report            — Sparkpage 보고서 생성
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { generateSearchQueries, classifyClaim } from "./query-generator.js";
import { searchEvidence } from "./search.js";
import { extractPageContent } from "./extractor.js";
import { scoreSourceQuality } from "./source-scorer.js";
import { checkKoreanStats } from "./korean-stats.js";
import { detectDuplicates } from "./duplicate-detector.js";
import { calculateConfidence } from "./confidence.js";
import { formatReport, type ClaimVerification, type SearchLogEntry, type FullReport } from "./report-formatter.js";
import { getDomainAuthority } from "./domains.js";

const server = new McpServer({
    name: "miny_factcheck-mcp",
    version: "1.0.0",
});

// ═══════════════════════════════════════
// Tool 1: generate_search_queries
// ═══════════════════════════════════════

server.tool(
    "generate_search_queries",
    "주장에 대한 5전략(Precision/Recall/Primary-source/Contradiction/Local-language) 검색 쿼리를 자동 생성합니다. 각 전략별로 최적화된 검색어, 날짜 필터, 도메인 필터를 포함합니다.",
    {
        claim: z.string().describe("검증할 주장 텍스트"),
        category: z.enum(["NUMBER", "DATE", "RANKING", "CAUSATION", "ENTITY", "GENERAL"]).optional()
            .describe("주장 카테고리. 미입력 시 자동 분류"),
        temporalClass: z.enum(["STATIC", "SLOW_CHANGE", "FAST_CHANGE"]).optional()
            .describe("시간 분류. 미입력 시 자동 분류"),
        topic: z.string().optional().describe("주제 힌트 (1차 출처 도메인 선택에 사용)"),
    },
    async ({ claim, category, temporalClass, topic }) => {
        // 자동 분류
        const autoClassified = classifyClaim(claim);
        const finalCategory = category ?? autoClassified.category;
        const finalTemporal = temporalClass ?? autoClassified.temporal;

        const queries = generateSearchQueries(claim, finalCategory, finalTemporal, topic);

        const result = {
            claim,
            classification: {
                category: finalCategory,
                temporalClass: finalTemporal,
                autoDetected: !category || !temporalClass,
            },
            queries,
            totalQueries: queries.length,
            searchInstructions: "각 쿼리를 search_evidence 도구로 실행하세요. Contradiction 전략은 Devil's Advocate로, 반증을 찾기 위한 것입니다.",
        };

        return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
    }
);

// ═══════════════════════════════════════
// Tool 2: search_evidence
// ═══════════════════════════════════════

server.tool(
    "search_evidence",
    "실제 웹 검색을 수행합니다. Naver Search API + Google Custom Search API를 사용하여 뉴스/웹 검색 결과를 반환합니다. API 키가 없으면 검색 URL을 제공합니다.",
    {
        query: z.string().describe("검색 쿼리"),
        strategy: z.string().optional().describe("검색 전략명 (precision, recall, contradiction 등)"),
        maxResults: z.number().optional().describe("최대 결과 수 (기본 10)"),
        dateFilterDays: z.number().optional().describe("날짜 필터 — 최근 N일 이내"),
        domainFilter: z.array(z.string()).optional().describe("도메인 필터 (예: ['kostat.go.kr', 'imf.org'])"),
        language: z.enum(["ko", "en", "both"]).optional().describe("검색 언어 (기본 both)"),
    },
    async ({ query, strategy, maxResults, dateFilterDays, domainFilter, language }) => {
        const response = await searchEvidence(query, strategy || "manual", {
            maxResults,
            dateFilter: dateFilterDays ? { days: dateFilterDays } : undefined,
            domainFilter,
            language,
        });

        return {
            content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
        };
    }
);

// ═══════════════════════════════════════
// Tool 3: extract_page_content
// ═══════════════════════════════════════

server.tool(
    "extract_page_content",
    "URL에서 본문 텍스트, 발행일, 저자, 핵심 팩트(숫자/날짜/비율)를 추출합니다. cheerio로 HTML을 파싱하여 기사 본문을 깔끔하게 추출합니다.",
    {
        url: z.string().describe("콘텐츠를 추출할 URL"),
    },
    async ({ url }) => {
        const content = await extractPageContent(url);
        return {
            content: [{ type: "text" as const, text: JSON.stringify(content, null, 2) }],
        };
    }
);

// ═══════════════════════════════════════
// Tool 4: score_source_quality
// ═══════════════════════════════════════

server.tool(
    "score_source_quality",
    "출처의 품질을 3차원(Authority/Independence/Recency)으로 자동 채점합니다. 200+ 도메인 권위 DB에서 매칭하고, Wire-copy 패턴을 감지합니다.",
    {
        domain: z.string().describe("출처 도메인 (예: kostat.go.kr)"),
        publishDate: z.string().optional().describe("발행일 (YYYY-MM-DD)"),
        temporalClass: z.enum(["STATIC", "SLOW_CHANGE", "FAST_CHANGE"]).optional()
            .describe("주장의 시간 분류 (최신성 평가 기준) — 기본 SLOW_CHANGE"),
        contentSnippet: z.string().optional().describe("콘텐츠 일부 (Wire-copy 감지용)"),
    },
    async ({ domain, publishDate, temporalClass, contentSnippet }) => {
        const score = scoreSourceQuality(
            domain,
            publishDate ?? null,
            temporalClass || "SLOW_CHANGE",
            contentSnippet,
        );

        return {
            content: [{ type: "text" as const, text: JSON.stringify(score, null, 2) }],
        };
    }
);

// ═══════════════════════════════════════
// Tool 5: check_korean_stats
// ═══════════════════════════════════════

server.tool(
    "check_korean_stats",
    "한국 공식 통계를 직접 조회합니다. KOSIS(국가통계포털), 한국은행 ECOS API를 호출합니다. API 키가 없으면 검색 URL을 제공합니다.",
    {
        keyword: z.string().describe("검색 키워드 (예: 'GDP', '인구', '소비자물가')"),
        category: z.string().optional().describe("카테고리 (예: '경제', '인구', '산업')"),
    },
    async ({ keyword, category }) => {
        const response = await checkKoreanStats(keyword, category);
        return {
            content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
        };
    }
);

// ═══════════════════════════════════════
// Tool 6: detect_duplicates
// ═══════════════════════════════════════

server.tool(
    "detect_duplicates",
    "여러 출처가 실은 같은 원본(Wire-copy)인지 감지합니다. n-gram Jaccard 유사도 + 통신사 패턴 분석으로 독립 출처 수를 재계산합니다.",
    {
        sources: z.array(z.object({
            id: z.string().describe("출처 식별자"),
            title: z.string().describe("기사 제목"),
            snippet: z.string().describe("본문 일부 (200자+)"),
            domain: z.string().describe("도메인"),
            url: z.string().describe("URL"),
        })).describe("판별할 출처 목록"),
        threshold: z.number().optional().describe("유사도 임계값 (기본 0.7 = 70%+이면 중복)"),
    },
    async ({ sources, threshold }) => {
        const result = detectDuplicates(sources, threshold);
        return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
    }
);

// ═══════════════════════════════════════
// Tool 7: calculate_confidence
// ═══════════════════════════════════════

server.tool(
    "calculate_confidence",
    "증거를 기반으로 수학 공식으로 신뢰도(0-100)를 계산하고 판정(TRUE/FALSE/MIXED 등)을 내립니다. 독립성/오래됨/Devil's Advocate 보정을 자동 적용합니다.",
    {
        agreeingSources: z.array(z.object({
            domain: z.string(),
            qualityScore: z.number().describe("소스 품질 점수 (0-100)"),
            authority: z.string(),
            independence: z.string(),
            recency: z.string(),
        })).describe("주장에 동의하는 출처 목록"),
        contradictingSources: z.array(z.object({
            domain: z.string(),
            qualityScore: z.number(),
            authority: z.string(),
            independence: z.string(),
            recency: z.string(),
        })).optional().describe("주장에 반대하는 출처 목록"),
        temporalClass: z.enum(["STATIC", "SLOW_CHANGE", "FAST_CHANGE"])
            .describe("주장의 시간 분류"),
        newestSourceAgeDays: z.number().describe("가장 최신 출처의 경과 일수"),
        uniqueSourceRatio: z.number().describe("독립 출처 비율 (0~1, 예: 0.75)"),
        devilsAdvocateFound: z.boolean().describe("Devil's Advocate 검색에서 반증을 발견했는가"),
        devilsAdvocateStrength: z.enum(["none", "weak", "moderate", "strong"]).optional()
            .describe("반증의 강도"),
    },
    async ({
        agreeingSources,
        contradictingSources,
        temporalClass,
        newestSourceAgeDays,
        uniqueSourceRatio,
        devilsAdvocateFound,
        devilsAdvocateStrength
    }) => {
        const result = calculateConfidence({
            agreeingSources: agreeingSources.map(s => ({
                domain: s.domain,
                domainName: getDomainAuthority(s.domain).name,
                authority: s.authority as any,
                independence: s.independence as any,
                recency: s.recency as any,
                qualityScore: s.qualityScore,
                tags: `${s.authority}/${s.independence}/${s.recency}`,
                isWireService: false,
                warnings: [],
            })),
            contradictingSources: (contradictingSources || []).map(s => ({
                domain: s.domain,
                domainName: getDomainAuthority(s.domain).name,
                authority: s.authority as any,
                independence: s.independence as any,
                recency: s.recency as any,
                qualityScore: s.qualityScore,
                tags: `${s.authority}/${s.independence}/${s.recency}`,
                isWireService: false,
                warnings: [],
            })),
            temporalClass,
            newestSourceAgeDays,
            uniqueSourceRatio,
            devilsAdvocateFound,
            devilsAdvocateStrength: devilsAdvocateStrength || "none",
            hasAnySource: agreeingSources.length > 0 || (contradictingSources || []).length > 0,
        });

        return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
    }
);

// ═══════════════════════════════════════
// Tool 8: format_report
// ═══════════════════════════════════════

server.tool(
    "format_report",
    "전체 팩트체크 결과를 Genspark Sparkpage 스타일의 구조화된 마크다운 보고서로 생성합니다. 검색기록/종합판정/증거테이블/심층분석/인용출처/수정제안 포함.",
    {
        claims: z.array(z.object({
            id: z.number(),
            originalText: z.string(),
            atomicClaim: z.string(),
            category: z.string(),
            temporalClass: z.string(),
            implicit: z.boolean().optional(),
            verdict: z.string(),
            verdictEmoji: z.string(),
            confidence: z.number(),
            formula: z.string().optional(),
            sources: z.array(z.object({
                domain: z.string(),
                domainName: z.string(),
                authority: z.string(),
                independence: z.string(),
                recency: z.string(),
                qualityScore: z.number(),
                tags: z.string(),
            })).optional(),
            searchLog: z.array(z.object({
                query: z.string(),
                strategy: z.string(),
                resultCount: z.number(),
                targetClaim: z.string(),
            })).optional(),
            devilsAdvocateNotes: z.string().optional(),
            correctionSuggestion: z.string().optional(),
        })).describe("검증된 주장 배열"),
        inputText: z.string().optional().describe("원본 입력 텍스트"),
    },
    async ({ claims, inputText }) => {
        const fullReport: FullReport = {
            claims: claims.map(c => ({
                id: c.id,
                originalText: c.originalText,
                atomicClaim: c.atomicClaim,
                category: c.category,
                temporalClass: c.temporalClass,
                implicit: c.implicit ?? false,
                confidence: {
                    confidence: c.confidence,
                    verdict: c.verdict as any,
                    verdictEmoji: c.verdictEmoji,
                    formula: c.formula || "",
                    baseScore: c.confidence,
                    adjustments: [],
                    totalAdjustment: 0,
                    explanation: "",
                },
                sources: (c.sources || []).map(s => ({
                    domain: s.domain,
                    domainName: s.domainName,
                    authority: s.authority as any,
                    independence: s.independence as any,
                    recency: s.recency as any,
                    qualityScore: s.qualityScore,
                    tags: s.tags,
                    isWireService: false,
                    warnings: [] as string[],
                })),
                searchLog: c.searchLog || [],
                devilsAdvocateNotes: c.devilsAdvocateNotes || "",
                duplicateGroups: [],
                correctionSuggestion: c.correctionSuggestion,
            })) as ClaimVerification[],
            totalSearches: claims.reduce((sum, c) => sum + (c.searchLog?.length || 0), 0),
            executedAt: new Date().toISOString(),
            inputText: inputText || "",
        };

        const report = formatReport(fullReport);

        return {
            content: [{ type: "text" as const, text: report }],
        };
    }
);

// ═══════════════════════════════════════
// 서버 시작
// ═══════════════════════════════════════

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("miny_factcheck-mcp v1.0.0 — 8 tools ready");
}

main().catch(console.error);
