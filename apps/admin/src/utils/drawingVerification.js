/** 새 Seed 독립 재실행 단계에서 실패했음을 뜻하는 BE failureCode 목록이다. */
const INDEPENDENT_REPLAY_FAILURE_CODES = [
  "REPLAY_RESULT_INVALID",
  "INSUFFICIENT_CANDIDATES",
];

/** boolean 값들을 하나의 판정으로 합친다. 하나라도 false면 실패, 모두 true면 통과, 그 외는 알 수 없음이다. */
function combine(values) {
  if (values.some((value) => value === false)) return "fail";
  if (values.every((value) => value === true)) return "pass";
  return "unknown";
}

/** 이 검증 이력이 재현 항목을 갖지 않는 이전 방식(LEGACY_INTEGRITY) 이력인지 판단한다. */
export function isLegacyVerification(verification) {
  return verification?.verificationMode === "LEGACY_INTEGRITY";
}

/** 원본 Seed 재현이 최초 당첨자·순위와 같았는지를 "same"/"different"/"unknown"으로 판정한다. */
export function replaySameWinners(verification) {
  if (!verification || isLegacyVerification(verification)) return "unknown";
  const result = combine([
    verification.ranksMatched,
    verification.resultHashMatched,
  ]);
  if (result === "pass") return "same";
  if (result === "fail") return "different";
  return "unknown";
}

/** 검증 응답의 boolean·인원 수 필드를 운영자용 체크리스트 항목으로 변환한다. */
export function verificationChecks(verification) {
  if (!verification || isLegacyVerification(verification)) return [];
  const expected = verification.expectedWinnerCount;
  const actual = verification.actualWinnerCount;
  const independent = INDEPENDENT_REPLAY_FAILURE_CODES.includes(
    verification.failureCode,
  )
    ? "fail"
    : verification.status === "VERIFIED"
      ? "pass"
      : "unknown";
  return [
    {
      key: "seedReplay",
      label: "원본 Seed 재현 — 당첨자·순위",
      state: combine([verification.ranksMatched]),
    },
    {
      key: "winnerCount",
      label: "당첨 인원",
      state: combine([verification.winnerCountMatched]),
      detail:
        expected == null || actual == null
          ? null
          : `기대 ${expected}명 / 재현 ${actual}명`,
    },
    {
      key: "resultHash",
      label: "결과 Hash",
      state: combine([verification.resultHashMatched]),
    },
    {
      key: "candidates",
      label: "후보·제외 명단·중복 없음",
      state: combine([
        verification.candidatesMatched,
        verification.exclusionsMatched,
        verification.winnersUnique,
      ]),
    },
    {
      key: "integrity",
      label: "Snapshot·입력 무결성·알고리즘",
      state: combine([
        verification.snapshotHashMatched,
        verification.inputHashMatched,
        verification.algorithmMatched,
      ]),
    },
    {
      key: "independentReplay",
      label: "새 Seed 독립 재실행 (인원·규칙)",
      state: independent,
    },
  ];
}

/** 같은 순위의 최초 당첨자와 재현 당첨자가 같은 사람이고 상품도 같은지 판단한다. */
function sameWinner(original, replayed) {
  if (!original || !replayed) return false;
  if (original.userId !== replayed.userId) return false;
  if (original.prizeKey != null && replayed.prizeKey != null) {
    return original.prizeKey === replayed.prizeKey;
  }
  return true;
}

/**
 * 최초 당첨자와 재현 당첨자를 순위별로 짝지어 비교한다.
 * 재현 당첨자 목록이 없으면(null·undefined) 비교할 수 없으므로 null을 반환한다.
 */
export function compareWinners(originalWinners, replayedWinners) {
  if (!Array.isArray(replayedWinners)) return null;
  const originals = new Map(
    (originalWinners ?? []).map((winner) => [winner.rankInDrawing, winner]),
  );
  const replays = new Map(
    replayedWinners.map((winner) => [winner.rankInDrawing, winner]),
  );
  const ranks = [...new Set([...originals.keys(), ...replays.keys()])].sort(
    (a, b) => a - b,
  );
  const rows = ranks.map((rank) => {
    const original = originals.get(rank) ?? null;
    const replayed = replays.get(rank) ?? null;
    return { rank, original, replayed, matched: sameWinner(original, replayed) };
  });
  const matched = rows.filter((row) => row.matched).length;
  return {
    rows,
    matched,
    total: rows.length,
    rate: rows.length ? Math.round((matched / rows.length) * 100) : 0,
  };
}
