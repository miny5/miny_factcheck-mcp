/**
 * confidence.ts — 수학적 신뢰도 계산 엔진
 * 
 * 증거 배열을 입력받아 수학 공식으로 신뢰도를 계산하고,
 * 보정 규칙을 자동 적용하여 최종 판정을 내립니다.
 */

import type { SourceQualityScore } from "./source-scorer.js";

export type Verdict = "TRUE" | "LIKELY_TRUE" | "MIXED" | "MISLEADING" | "LIKELY_FALSE" | "FALSE" | "OUTDATED" | "UNVERIFIABLE";

export interface ConfidenceInput {
    agreeingSources: SourceQualityScore[];
    contradictingSources: SourceQualityScore[];
    temporalClass: "STATIC" | "SLOW_CHANGE" | "FAST_CHANGE";
    newestSourceAgeDays: number;
    uniqueSourceRatio: number;       // 독립 출처 비율 (0~1)
    devilsAdvocateFound: boolean;
    devilsAdvocateStrength: "none" | "weak" | "moderate" | "strong";
    hasAnySource: boolean;
}

export interface Adjustment {
    reason: string;
    amount: number;
    applied: boolean;
}

export interface ConfidenceResult {
    confidence: number;
    verdict: Verdict;
    verdictEmoji: string;
    formula: string;
    baseScore: number;
    adjustments: Adjustment[];
    totalAdjustment: number;
    explanation: string;
}

/**
 * 신뢰도를 수학적으로 계산합니다.
 * 
 * 공식:
 *   base = Σ(source.qualityScore × weight) / maxPossible × 100
 *   final = base + adjustments
 */
export function calculateConfidence(input: ConfidenceInput): ConfidenceResult {
    const adjustments: Adjustment[] = [];

    // 출처가 하나도 없으면 UNVERIFIABLE
    if (!input.hasAnySource || (input.agreeingSources.length === 0 && input.contradictingSources.length === 0)) {
        return {
            confidence: 0,
            verdict: "UNVERIFIABLE",
            verdictEmoji: "❓",
            formula: "출처 미발견 → UNVERIFIABLE",
            baseScore: 0,
            adjustments: [],
            totalAdjustment: 0,
            explanation: "확인 또는 부정할 공개 증거가 부족합니다.",
        };
    }

    // === Base Score 계산 ===
    const totalAgreeing = input.agreeingSources.length;
    const totalContradicting = input.contradictingSources.length;
    const totalSources = totalAgreeing + totalContradicting;

    // 동의 출처의 가중 합산
    const agreeingWeightedSum = input.agreeingSources.reduce((sum, s) => sum + s.qualityScore, 0);
    const contradictingWeightedSum = input.contradictingSources.reduce((sum, s) => sum + s.qualityScore, 0);

    // 최대 가능 점수 (모든 출처가 AUTH:HIGH/IND:ORIGINAL/REC:CURRENT = 100)
    const maxPossible = totalSources * 100;

    // base: 동의 쪽 비중
    let baseScore: number;
    if (maxPossible === 0) {
        baseScore = 0;
    } else {
        const netScore = agreeingWeightedSum - (contradictingWeightedSum * 0.5);
        baseScore = Math.max(0, Math.min(100, (netScore / maxPossible) * 100));
    }

    // 출처 수 보너스/페널티
    if (totalAgreeing >= 3) {
        baseScore = Math.min(100, baseScore * 1.1); // 3개+ 동의 출처 보너스
    }
    if (totalAgreeing === 1 && totalContradicting === 0) {
        baseScore = Math.min(baseScore, 65); // 단일 출처 캡
    }

    // === 보정 규칙 적용 ===
    let totalAdj = 0;

    // 보정 1: 독립성 패널티
    const independenceAdj: Adjustment = {
        reason: `독립 출처 비율 ${Math.round(input.uniqueSourceRatio * 100)}% — 모든 출처가 같은 원본에서 유래`,
        amount: -15,
        applied: false,
    };
    if (input.uniqueSourceRatio < 0.5 && totalSources >= 2) {
        independenceAdj.applied = true;
        totalAdj += independenceAdj.amount;
    }
    adjustments.push(independenceAdj);

    // 보정 2: 오래됨 패널티
    const stalenessAdj: Adjustment = {
        reason: `FAST_CHANGE 주장인데 최신 출처 ${input.newestSourceAgeDays}일 경과`,
        amount: -10,
        applied: false,
    };
    if (input.temporalClass === "FAST_CHANGE" && input.newestSourceAgeDays > 7) {
        stalenessAdj.applied = true;
        totalAdj += stalenessAdj.amount;
    }
    adjustments.push(stalenessAdj);

    // 보정 3: SLOW_CHANGE 오래됨
    const slowStaleAdj: Adjustment = {
        reason: `SLOW_CHANGE 주장인데 최신 출처 ${input.newestSourceAgeDays}일 경과`,
        amount: -5,
        applied: false,
    };
    if (input.temporalClass === "SLOW_CHANGE" && input.newestSourceAgeDays > 90) {
        slowStaleAdj.applied = true;
        totalAdj += slowStaleAdj.amount;
    }
    adjustments.push(slowStaleAdj);

    // 보정 4: Devil's Advocate 반증
    const daAmount = input.devilsAdvocateStrength === "strong" ? -20 :
        input.devilsAdvocateStrength === "moderate" ? -15 :
            input.devilsAdvocateStrength === "weak" ? -10 : 0;
    const devilsAdj: Adjustment = {
        reason: `Devil's Advocate 반증 발견 (강도: ${input.devilsAdvocateStrength})`,
        amount: daAmount,
        applied: false,
    };
    if (input.devilsAdvocateFound && daAmount !== 0) {
        devilsAdj.applied = true;
        totalAdj += devilsAdj.amount;
    }
    adjustments.push(devilsAdj);

    // 보정 5: 모순 출처 페널티
    const contradictionAdj: Adjustment = {
        reason: `${totalContradicting}개 모순 출처 발견`,
        amount: -(totalContradicting * 5),
        applied: false,
    };
    if (totalContradicting > 0) {
        contradictionAdj.applied = true;
        totalAdj += contradictionAdj.amount;
    }
    adjustments.push(contradictionAdj);

    // 최종 점수 계산
    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore + totalAdj)));

    // === 판정 매핑 ===
    let verdict: Verdict;
    let verdictEmoji: string;

    if (totalContradicting > totalAgreeing) {
        verdict = "FALSE";
        verdictEmoji = "❌";
    } else if (totalContradicting > 0 && totalAgreeing > 0 && totalContradicting >= totalAgreeing * 0.5) {
        verdict = "MIXED";
        verdictEmoji = "⚠️";
    } else if (finalScore >= 90) {
        verdict = "TRUE";
        verdictEmoji = "✅";
    } else if (finalScore >= 70) {
        verdict = "LIKELY_TRUE";
        verdictEmoji = "🟢";
    } else if (finalScore >= 50) {
        verdict = "MIXED";
        verdictEmoji = "⚠️";
    } else if (finalScore >= 30) {
        verdict = "LIKELY_FALSE";
        verdictEmoji = "🟠";
    } else if (finalScore >= 10) {
        verdict = "FALSE";
        verdictEmoji = "❌";
    } else {
        verdict = "FALSE";
        verdictEmoji = "❌";
    }

    // 특수 판정: OUTDATED
    if (input.temporalClass !== "STATIC" && input.newestSourceAgeDays > (input.temporalClass === "FAST_CHANGE" ? 30 : 180)) {
        verdict = "OUTDATED";
        verdictEmoji = "🕐";
    }

    // 공식 문자열
    const formula = [
        `base = ${Math.round(baseScore)} (동의 ${totalAgreeing}건 × 품질, 모순 ${totalContradicting}건)`,
        ...adjustments.filter(a => a.applied).map(a => `${a.amount > 0 ? "+" : ""}${a.amount} (${a.reason})`),
        `= 최종 ${finalScore}점 → ${verdict}`,
    ].join("\n");

    const explanation = buildExplanation(verdict, finalScore, input, adjustments);

    return {
        confidence: finalScore,
        verdict,
        verdictEmoji,
        formula,
        baseScore: Math.round(baseScore),
        adjustments,
        totalAdjustment: totalAdj,
        explanation,
    };
}

/**
 * 판정 설명을 생성합니다.
 */
function buildExplanation(
    verdict: Verdict,
    score: number,
    input: ConfidenceInput,
    adjustments: Adjustment[],
): string {
    const parts: string[] = [];
    const totalAgreeing = input.agreeingSources.length;
    const totalContradicting = input.contradictingSources.length;

    switch (verdict) {
        case "TRUE":
            parts.push(`복수의 독립 출처(${totalAgreeing}건)가 강하게 수렴하며, 신뢰할 만한 반증이 없습니다.`);
            break;
        case "LIKELY_TRUE":
            parts.push(`${totalAgreeing}건의 출처가 일치하나, 일부 불확실성이 있습니다.`);
            break;
        case "MIXED":
            parts.push(`출처 간 의견이 갈립니다 (동의 ${totalAgreeing}건, 모순 ${totalContradicting}건). 어느 부분이 사실인지 구분이 필요합니다.`);
            break;
        case "MISLEADING":
            parts.push(`기술적으로는 사실이나, 프레이밍이 합리적 해석을 왜곡하는 핵심 맥락이 누락되었습니다.`);
            break;
        case "FALSE":
            parts.push(`주장에 반하는 강력한 증거가 있으며, 1차 출처와 불일치합니다.`);
            break;
        case "LIKELY_FALSE":
            parts.push(`출처가 부족하거나 강한 모순이 발견되었습니다.`);
            break;
        case "OUTDATED":
            parts.push(`특정 시점에는 사실이었으나, 현재 최신 정보로 변경되었을 가능성이 높습니다.`);
            break;
        case "UNVERIFIABLE":
            parts.push(`확인 또는 부정할 공개 증거가 부족합니다.`);
            break;
    }

    const appliedAdj = adjustments.filter(a => a.applied);
    if (appliedAdj.length > 0) {
        parts.push(`보정 적용: ${appliedAdj.map(a => a.reason).join("; ")}`);
    }

    return parts.join(" ");
}
