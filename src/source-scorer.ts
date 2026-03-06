/**
 * source-scorer.ts — 3차원 소스 품질 자동 채점
 * 
 * Authority(권위) × Independence(독립성) × Recency(최신성) 태깅
 */

import { getDomainAuthority, isWireCopyContent, isWireServiceDomain, type AuthorityLevel } from "./domains.js";
import type { TemporalClass } from "./query-generator.js";

export type IndependenceLevel = "IND:ORIGINAL" | "IND:WIRE-COPY" | "IND:AGGREGATION";
export type RecencyLevel = "REC:CURRENT" | "REC:DATED" | "REC:ARCHIVAL";

export interface SourceQualityScore {
    domain: string;
    domainName: string;
    authority: AuthorityLevel;
    independence: IndependenceLevel;
    recency: RecencyLevel;
    qualityScore: number;      // 0~100
    tags: string;              // "AUTH:HIGH/IND:ORIGINAL/REC:CURRENT"
    isWireService: boolean;
    warnings: string[];
}

/**
 * 시간 분류별 최대 허용 일수
 */
const RECENCY_THRESHOLDS: Record<TemporalClass, number> = {
    STATIC: 365 * 100,    // 무제한
    SLOW_CHANGE: 90,       // 90일
    FAST_CHANGE: 7,        // 7일
};

/**
 * 권위 등급별 기본 점수
 */
const AUTHORITY_SCORES: Record<AuthorityLevel, number> = {
    "AUTH:HIGH": 40,
    "AUTH:MED": 25,
    "AUTH:LOW": 10,
};

/**
 * 독립성 등급별 점수
 */
const INDEPENDENCE_SCORES: Record<IndependenceLevel, number> = {
    "IND:ORIGINAL": 35,
    "IND:WIRE-COPY": 15,
    "IND:AGGREGATION": 10,
};

/**
 * 최신성 등급별 점수
 */
const RECENCY_SCORES: Record<RecencyLevel, number> = {
    "REC:CURRENT": 25,
    "REC:DATED": 15,
    "REC:ARCHIVAL": 5,
};

/**
 * 소스의 품질을 3차원으로 자동 채점합니다.
 */
export function scoreSourceQuality(
    domain: string,
    publishDate: string | null,
    temporalClass: TemporalClass,
    contentSnippet?: string,
): SourceQualityScore {
    const warnings: string[] = [];

    // 1. Authority (권위)
    const domainInfo = getDomainAuthority(domain);
    const authority = domainInfo.authority;

    // 2. Independence (독립성)
    let independence: IndependenceLevel = "IND:ORIGINAL";

    // 도메인이 통신사인 경우입
    if (isWireServiceDomain(domain)) {
        independence = "IND:ORIGINAL"; // 통신사 원본은 ORIGINAL
    }

    // 콘텐츠에서 Wire-copy 감지
    if (contentSnippet) {
        const wireCopyCheck = isWireCopyContent(contentSnippet);
        if (wireCopyCheck.isWireCopy && !isWireServiceDomain(domain)) {
            independence = "IND:WIRE-COPY";
            warnings.push(`통신사 재게시 감지: ${wireCopyCheck.origin}`);
        }

        // Aggregation 패턴 감지
        const aggregationPatterns = [
            /종합|정리|모아|요약|~에 따르면.*~에 따르면/,
            /round-?up|summary|aggregate/i,
        ];
        for (const pattern of aggregationPatterns) {
            if (pattern.test(contentSnippet)) {
                if (independence !== "IND:WIRE-COPY") {
                    independence = "IND:AGGREGATION";
                    warnings.push("집계/요약 콘텐츠로 감지");
                }
                break;
            }
        }
    }

    // 3. Recency (최신성)
    let recency: RecencyLevel = "REC:CURRENT";

    if (publishDate) {
        const pubDate = new Date(publishDate);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = RECENCY_THRESHOLDS[temporalClass];

        if (daysDiff <= threshold) {
            recency = "REC:CURRENT";
        } else if (daysDiff <= threshold * 3) {
            recency = "REC:DATED";
            if (temporalClass === "FAST_CHANGE") {
                warnings.push(`FAST_CHANGE 주장인데 ${daysDiff}일 경과 — 최신 출처 필요`);
            }
        } else {
            recency = temporalClass === "STATIC" ? "REC:ARCHIVAL" : "REC:DATED";
            if (temporalClass !== "STATIC") {
                warnings.push(`${daysDiff}일 경과 — 정보가 오래됐을 수 있음`);
            }
        }
    } else {
        recency = "REC:DATED"; // 날짜 없으면 DATED
        warnings.push("발행일 확인 불가");
    }

    // 종합 점수 계산
    const qualityScore = AUTHORITY_SCORES[authority] + INDEPENDENCE_SCORES[independence] + RECENCY_SCORES[recency];

    return {
        domain,
        domainName: domainInfo.name,
        authority,
        independence,
        recency,
        qualityScore,
        tags: `${authority}/${independence}/${recency}`,
        isWireService: isWireServiceDomain(domain),
        warnings,
    };
}

/**
 * 여러 소스의 품질을 일괄 채점합니다.
 */
export function scoreMultipleSources(
    sources: Array<{ domain: string; publishDate: string | null; content?: string }>,
    temporalClass: TemporalClass,
): SourceQualityScore[] {
    return sources.map(s =>
        scoreSourceQuality(s.domain, s.publishDate, temporalClass, s.content)
    );
}
