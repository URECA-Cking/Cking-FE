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

/**
 * 원본 Seed 재현 단계의 결과를 "pass"/"fail"/"unknown"으로 판정한다.
 * BE는 이 단계의 일치 여부를 resultHashMatched 하나로 판정하지만, 재현 전 단계(Snapshot·저장 Input/Result 무결성)에서
 * 실패해도 false가 올 수 있으므로 실제 불일치(DETERMINISTIC_REPLAY_MISMATCH)일 때만 fail로 본다.
 */
function seedReplayState(verification) {
  if (verification.resultHashMatched === true) return "pass";
  if (
    verification.resultHashMatched === false &&
    verification.failureCode === "DETERMINISTIC_REPLAY_MISMATCH"
  )
    return "fail";
  return "unknown";
}

/**
 * 원본 Seed 재현이 최초 당첨자·순위·상품과 같았는지를 "same"/"different"/"unknown"으로 판정한다.
 * 재현 단계에 도달하지 못한 실패는 당첨자가 다르다고 단정할 수 없으므로 "unknown"이다.
 * (ranksMatched는 새 Seed 재실행의 순위 연속성이라 여기서 쓰지 않는다.)
 */
export function replaySameWinners(verification) {
  if (!verification || isLegacyVerification(verification)) return "unknown";
  const state = seedReplayState(verification);
  if (state === "pass") return "same";
  if (state === "fail") return "different";
  return "unknown";
}

/** 검증 응답의 boolean·인원 수 필드를 운영자용 체크리스트 항목으로 변환한다. */
export function verificationChecks(verification) {
  if (!verification || isLegacyVerification(verification)) return [];
  const expected = verification.expectedWinnerCount;
  const actual = verification.actualWinnerCount;
  return [
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
      key: "seedReplay",
      label: "원본 Seed 재현 — 당첨자·순위·상품·결과 Hash",
      state: seedReplayState(verification),
    },
    {
      key: "winnerCount",
      label: "새 Seed 독립 재실행 — 당첨 인원",
      state: combine([verification.winnerCountMatched]),
      detail:
        expected == null || actual == null
          ? null
          : `기대 ${expected}명 / 재실행 ${actual}명`,
    },
    {
      key: "candidates",
      label: "새 Seed 독립 재실행 — 후보·제외 명단·중복 없음",
      state: combine([
        verification.candidatesMatched,
        verification.exclusionsMatched,
        verification.winnersUnique,
      ]),
    },
    {
      key: "rankContinuity",
      label: "새 Seed 독립 재실행 — 순위 연속(1..N)",
      state: combine([verification.ranksMatched]),
    },
  ];
}

/** 같은 순위의 최초 당첨자와 재현 당첨자가 같은 사람이고 상품도 같은지 판단한다. */
function sameWinner(original, replayed) {
  if (!original || !replayed) return false;
  if (original.userId !== replayed.userId) return false;
  return (original.prizeKey ?? null) === (replayed.prizeKey ?? null);
}

/**
 * 최초 당첨자와 재현 당첨자를 순위별로 짝지어 비교한다.
 * 최초·재현 당첨자 목록 중 하나라도 없으면(null·undefined, 로딩 중 포함) 비교할 수 없으므로 null을 반환한다.
 */
export function compareWinners(originalWinners, replayedWinners) {
  if (!Array.isArray(originalWinners) || !Array.isArray(replayedWinners))
    return null;
  const originals = new Map(
    originalWinners.map((winner) => [winner.rankInDrawing, winner]),
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
