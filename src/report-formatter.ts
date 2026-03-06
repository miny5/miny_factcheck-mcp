/**
 * report-formatter.ts — Genspark Sparkpage 스타일 보고서 생성기
 */

import type { ConfidenceResult, Verdict } from "./confidence.js";
import type { SourceQualityScore } from "./source-scorer.js";
import type { SearchResponse } from "./search.js";
import type { DuplicateGroup } from "./duplicate-detector.js";

export interface ClaimVerification {
    id: number;
    originalText: string;
    atomicClaim: string;
    category: string;
    temporalClass: string;
    implicit: boolean;
    confidence: ConfidenceResult;
    sources: SourceQualityScore[];
    searchLog: SearchLogEntry[];
    devilsAdvocateNotes: string;
    duplicateGroups: DuplicateGroup[];
    correctionSuggestion?: string;
}

export interface SearchLogEntry {
    query: string;
    strategy: string;
    resultCount: number;
    targetClaim: string;
}

export interface FullReport {
    claims: ClaimVerification[];
    totalSearches: number;
    executedAt: string;
    inputText: string;
}

/**
 * 전체 팩트체크 보고서를 생성합니다.
 */
export function formatReport(report: FullReport): string {
    const sections: string[] = [];

    // === 헤더 ===
    sections.push("## 📋 팩트체크 보고서\n");
    sections.push(`> 실행 시각: ${report.executedAt}`);
    sections.push(`> 총 검증 주장: ${report.claims.length}건 | 총 검색: ${report.totalSearches}회\n`);

    // === (0) 검색 기록 ===
    sections.push("### (0) 검색 기록\n");
    const allSearchLogs = report.claims.flatMap(c => c.searchLog);
    if (allSearchLogs.length > 0) {
        sections.push("| # | 검색어 | 전략 | 결과 수 | 대상 주장 |");
        sections.push("| - | ------ | ---- | ------- | --------- |");
        allSearchLogs.forEach((log, i) => {
            const claimShort = log.targetClaim.length > 30
                ? log.targetClaim.slice(0, 30) + "..."
                : log.targetClaim;
            sections.push(`| ${i + 1} | ${log.query.slice(0, 50)} | ${log.strategy} | ${log.resultCount}건 | ${claimShort} |`);
        });
    } else {
        sections.push("_검색 기록 없음_");
    }
    sections.push("");

    // === (1) 종합 판정 ===
    sections.push("### (1) 종합 판정\n");
    const trueCount = report.claims.filter(c => c.confidence.verdict === "TRUE" || c.confidence.verdict === "LIKELY_TRUE").length;
    const falseCount = report.claims.filter(c => c.confidence.verdict === "FALSE" || c.confidence.verdict === "LIKELY_FALSE").length;
    const mixedCount = report.claims.filter(c => c.confidence.verdict === "MIXED" || c.confidence.verdict === "MISLEADING").length;
    const otherCount = report.claims.length - trueCount - falseCount - mixedCount;

    sections.push(`총 **${report.claims.length}건** 검증 완료.`);
    if (trueCount > 0) sections.push(`- ✅ 사실/사실가능성 높음: **${trueCount}건**`);
    if (falseCount > 0) sections.push(`- ❌ 거짓/거짓가능성 높음: **${falseCount}건**`);
    if (mixedCount > 0) sections.push(`- ⚠️ 혼합/오해소지: **${mixedCount}건**`);
    if (otherCount > 0) sections.push(`- 기타(OUTDATED/UNVERIFIABLE): **${otherCount}건**`);

    const avgConfidence = report.claims.length > 0
        ? Math.round(report.claims.reduce((sum, c) => sum + c.confidence.confidence, 0) / report.claims.length)
        : 0;
    sections.push(`\n**평균 신뢰도: ${avgConfidence}/100**`);

    if (falseCount > 0 || mixedCount > 0) {
        sections.push(`\n> ⚠️ **${falseCount + mixedCount}건의 주장에 수정이 필요합니다.** 아래 증거 테이블과 수정 제안을 확인하세요.`);
    }
    sections.push("");

    // === (2) 검증 주장 목록 ===
    sections.push("### (2) 검증 주장 목록\n");
    sections.push("| # | 원자적 주장 | 카테고리 | 시간 분류 | 암묵적? |");
    sections.push("| - | ----------- | -------- | --------- | ------- |");
    for (const claim of report.claims) {
        const claimText = claim.atomicClaim.length > 60
            ? claim.atomicClaim.slice(0, 60) + "..."
            : claim.atomicClaim;
        sections.push(`| ${claim.id} | ${claimText} | ${claim.category} | ${getTemporalEmoji(claim.temporalClass)} ${claim.temporalClass} | ${claim.implicit ? "예" : "-"} |`);
    }
    sections.push("");

    // === (3) 증거 테이블 ===
    sections.push("### (3) 증거 테이블\n");
    sections.push("| # | 주장 | 판정 | 신뢰도 | 최고 출처 | 태그 | 핵심 노트 |");
    sections.push("| - | ---- | ---- | ------ | --------- | ---- | --------- |");
    for (const claim of report.claims) {
        const claimShort = claim.atomicClaim.length > 40
            ? claim.atomicClaim.slice(0, 40) + "..."
            : claim.atomicClaim;
        const bestSource = claim.sources.length > 0
            ? claim.sources.sort((a, b) => b.qualityScore - a.qualityScore)[0]
            : null;
        const sourceStr = bestSource ? bestSource.domainName : "없음";
        const tagsStr = bestSource ? bestSource.tags : "-";
        const notes = claim.devilsAdvocateNotes || claim.confidence.explanation.slice(0, 50);

        sections.push(`| ${claim.id} | ${claimShort} | ${claim.confidence.verdictEmoji} ${claim.confidence.verdict} | ${claim.confidence.confidence}/100 | ${sourceStr} | ${tagsStr} | ${notes.slice(0, 50)} |`);
    }
    sections.push("");

    // === (4) 심층 분석 ===
    sections.push("### (4) 심층 분석 (교차 검증)\n");
    for (const claim of report.claims) {
        sections.push(`**주장 ${claim.id}: ${claim.atomicClaim}**\n`);
        sections.push(`- 판정: ${claim.confidence.verdictEmoji} **${claim.confidence.verdict}** (신뢰도 ${claim.confidence.confidence}/100)`);
        sections.push(`- 계산 공식:\n\`\`\`\n${claim.confidence.formula}\n\`\`\``);

        if (claim.confidence.adjustments.filter(a => a.applied).length > 0) {
            sections.push("- 적용된 보정:");
            for (const adj of claim.confidence.adjustments.filter(a => a.applied)) {
                sections.push(`  - ${adj.amount > 0 ? "+" : ""}${adj.amount}: ${adj.reason}`);
            }
        }

        if (claim.devilsAdvocateNotes) {
            sections.push(`- Devil's Advocate: ${claim.devilsAdvocateNotes}`);
        }

        if (claim.duplicateGroups.length > 0) {
            sections.push(`- 중복 감지: ${claim.duplicateGroups.length}개 그룹 (독립 출처 재계산됨)`);
        }

        sections.push("");
    }

    // === (5) 인용 출처 ===
    sections.push("### (5) 인용 출처\n");
    const allSources = report.claims.flatMap(c => c.sources);
    const uniqueSources = new Map<string, SourceQualityScore>();
    for (const s of allSources) {
        if (!uniqueSources.has(s.domain)) {
            uniqueSources.set(s.domain, s);
        }
    }

    if (uniqueSources.size > 0) {
        sections.push("| # | 출처명 | 도메인 | 권위 | 독립성 | 최신성 | 품질 점수 |");
        sections.push("| - | ------ | ------ | ---- | ------ | ------ | --------- |");
        let idx = 1;
        for (const [domain, source] of uniqueSources) {
            sections.push(`| ${idx++} | ${source.domainName} | ${domain} | ${source.authority} | ${source.independence} | ${source.recency} | ${source.qualityScore}/100 |`);
        }
    } else {
        sections.push("_인용 출처 없음_");
    }
    sections.push("");

    // === (6) 남은 불확실성 ===
    sections.push("### (6) 남은 불확실성\n");
    const uncertainClaims = report.claims.filter(c =>
        c.confidence.confidence < 70 ||
        c.confidence.verdict === "UNVERIFIABLE" ||
        c.confidence.verdict === "MIXED"
    );
    if (uncertainClaims.length > 0) {
        sections.push("신뢰도를 높이기 위한 추가 조사 제안:\n");
        for (const claim of uncertainClaims) {
            sections.push(`- **주장 ${claim.id}** (${claim.confidence.verdict}, ${claim.confidence.confidence}점): ${getSuggestion(claim)}`);
        }
    } else {
        sections.push("모든 주장이 충분한 신뢰도로 검증되었습니다.");
    }
    sections.push("");

    // === (7) 수정 제안 ===
    const claimsNeedingCorrection = report.claims.filter(c =>
        c.confidence.verdict === "FALSE" ||
        c.confidence.verdict === "LIKELY_FALSE" ||
        c.confidence.verdict === "MIXED" ||
        c.confidence.verdict === "MISLEADING" ||
        c.confidence.verdict === "OUTDATED" ||
        c.confidence.confidence < 70
    );

    sections.push("### (7) 수정 제안\n");
    if (claimsNeedingCorrection.length > 0) {
        sections.push("| # | 원문 | 문제점 | 수정 제안 | 판정 |");
        sections.push("| - | ---- | ------ | --------- | ---- |");
        for (const claim of claimsNeedingCorrection) {
            const original = claim.atomicClaim.length > 40
                ? claim.atomicClaim.slice(0, 40) + "..."
                : claim.atomicClaim;
            const problem = getProblemDescription(claim.confidence.verdict);
            const suggestion = claim.correctionSuggestion || "최신 공식 출처 확인 후 수정 필요";
            sections.push(`| ${claim.id} | ${original} | ${problem} | ${suggestion} | ${claim.confidence.verdictEmoji} ${claim.confidence.verdict} |`);
        }
    } else {
        sections.push("수정이 필요한 주장이 없습니다. ✅");
    }

    return sections.join("\n");
}

// ═══════════════════════════════════════
// 헬퍼
// ═══════════════════════════════════════

function getTemporalEmoji(temporal: string): string {
    switch (temporal) {
        case "STATIC": return "🔵";
        case "SLOW_CHANGE": return "🟡";
        case "FAST_CHANGE": return "🔴";
        default: return "⚪";
    }
}

function getSuggestion(claim: ClaimVerification): string {
    if (claim.confidence.verdict === "UNVERIFIABLE") {
        return "추가 1차 출처 검색이 필요합니다 (정부/기관 공식 사이트)";
    }
    if (claim.confidence.verdict === "MIXED") {
        return "어느 부분이 사실이고 아닌지 구분하여 출처별로 확인해 주세요";
    }
    if (claim.confidence.confidence < 50) {
        return "독립적인 1차 출처를 최소 2개 더 확보해 주세요";
    }
    return "추가 교차 검증으로 신뢰도를 높일 수 있습니다";
}

function getProblemDescription(verdict: Verdict): string {
    switch (verdict) {
        case "FALSE": return "사실과 다름";
        case "LIKELY_FALSE": return "거짓 가능성 높음";
        case "MIXED": return "부분적 사실";
        case "MISLEADING": return "맥락 왜곡";
        case "OUTDATED": return "정보 변경됨";
        default: return "확인 필요";
    }
}
