/**
 * duplicate-detector.ts — Wire-copy 및 중복 출처 감지
 * 
 * 텍스트 유사도(n-gram Jaccard)로 같은 원본에서 파생된 기사를 감지합니다.
 */

export interface SourceForDedup {
    id: string;
    title: string;
    snippet: string;
    domain: string;
    url: string;
}

export interface DuplicateGroup {
    origin: string;
    originDomain: string;
    copies: Array<{ id: string; domain: string; similarity: number }>;
}

export interface DeduplicationResult {
    totalCount: number;
    uniqueCount: number;
    groups: DuplicateGroup[];
    deduplicatedSources: string[];  // 독립 출처 ID 목록
    removedAsCopies: string[];      // 중복으로 제거된 출처 ID 목록
}

/**
 * n-gram을 생성합니다.
 */
function getNgrams(text: string, n: number = 3): Set<string> {
    const cleaned = text
        .toLowerCase()
        .replace(/[^\w가-힣\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const ngrams = new Set<string>();
    for (let i = 0; i <= cleaned.length - n; i++) {
        ngrams.add(cleaned.substring(i, i + n));
    }
    return ngrams;
}

/**
 * 두 텍스트 간 Jaccard 유사도를 계산합니다. (0~1)
 */
function jaccardSimilarity(text1: string, text2: string, ngramSize: number = 3): number {
    const ngrams1 = getNgrams(text1, ngramSize);
    const ngrams2 = getNgrams(text2, ngramSize);

    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

    let intersection = 0;
    for (const gram of ngrams1) {
        if (ngrams2.has(gram)) intersection++;
    }

    const union = ngrams1.size + ngrams2.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * 통신사 원본 패턴을 감지합니다.
 */
function detectWireOrigin(text: string): string | null {
    const patterns: [RegExp, string][] = [
        [/\(연합뉴스\)|\[연합뉴스\]|연합뉴스\s*기자/i, "연합뉴스"],
        [/\(뉴시스\)|\[뉴시스\]/i, "뉴시스"],
        [/\(뉴스1\)|\[뉴스1\]/i, "뉴스1"],
        [/\(AP\)|Associated Press/i, "AP"],
        [/\(Reuters\)|로이터/i, "Reuters"],
        [/\(AFP\)|AFP통신/i, "AFP"],
        [/AP=연합뉴스/i, "AP(via 연합뉴스)"],
        [/Reuters=연합뉴스/i, "Reuters(via 연합뉴스)"],
    ];

    for (const [pattern, name] of patterns) {
        if (pattern.test(text)) return name;
    }
    return null;
}

/**
 * 여러 출처에서 중복(Wire-copy)을 감지하고 독립 출처를 식별합니다.
 * 
 * @param threshold - 유사도 임계값 (기본 0.7 = 70% 이상 유사하면 중복)
 */
export function detectDuplicates(
    sources: SourceForDedup[],
    threshold: number = 0.7,
): DeduplicationResult {
    if (sources.length <= 1) {
        return {
            totalCount: sources.length,
            uniqueCount: sources.length,
            groups: [],
            deduplicatedSources: sources.map(s => s.id),
            removedAsCopies: [],
        };
    }

    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();
    const removedAsCopies = new Set<string>();

    // 1. 통신사 원본 기반 그룹핑
    const wireOrigins = new Map<string, SourceForDedup[]>();
    for (const source of sources) {
        const combined = `${source.title} ${source.snippet}`;
        const origin = detectWireOrigin(combined);
        if (origin) {
            if (!wireOrigins.has(origin)) {
                wireOrigins.set(origin, []);
            }
            wireOrigins.get(origin)!.push(source);
        }
    }

    for (const [origin, wireSources] of wireOrigins) {
        if (wireSources.length >= 2) {
            // 첫 번째를 원본으로, 나머지를 복사본으로
            const [original, ...copies] = wireSources;
            const group: DuplicateGroup = {
                origin: original.id,
                originDomain: `${origin} (${original.domain})`,
                copies: copies.map(c => ({
                    id: c.id,
                    domain: c.domain,
                    similarity: 1.0, // 같은 통신사 인용
                })),
            };
            groups.push(group);
            processed.add(original.id);
            for (const copy of copies) {
                processed.add(copy.id);
                removedAsCopies.add(copy.id);
            }
        }
    }

    // 2. 텍스트 유사도 기반 그룹핑 (아직 처리되지 않은 출처)
    const remaining = sources.filter(s => !processed.has(s.id));

    for (let i = 0; i < remaining.length; i++) {
        if (removedAsCopies.has(remaining[i].id)) continue;

        const copies: DuplicateGroup["copies"] = [];
        const text1 = `${remaining[i].title} ${remaining[i].snippet}`;

        for (let j = i + 1; j < remaining.length; j++) {
            if (removedAsCopies.has(remaining[j].id)) continue;

            const text2 = `${remaining[j].title} ${remaining[j].snippet}`;
            const similarity = jaccardSimilarity(text1, text2);

            if (similarity >= threshold) {
                copies.push({
                    id: remaining[j].id,
                    domain: remaining[j].domain,
                    similarity: Math.round(similarity * 100) / 100,
                });
                removedAsCopies.add(remaining[j].id);
            }
        }

        if (copies.length > 0) {
            groups.push({
                origin: remaining[i].id,
                originDomain: remaining[i].domain,
                copies,
            });
        }
    }

    // 독립 출처 계산
    const deduplicatedSources = sources
        .filter(s => !removedAsCopies.has(s.id))
        .map(s => s.id);

    return {
        totalCount: sources.length,
        uniqueCount: deduplicatedSources.length,
        groups,
        deduplicatedSources,
        removedAsCopies: [...removedAsCopies],
    };
}
