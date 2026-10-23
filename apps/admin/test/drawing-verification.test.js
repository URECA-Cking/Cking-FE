import assert from "node:assert/strict";
import test from "node:test";
import {
  compareWinners,
  replaySameWinners,
  verificationChecks,
} from "../src/utils/drawingVerification.js";

const VERIFIED = {
  status: "VERIFIED",
  verificationMode: "DETERMINISTIC_AND_CARDINALITY_REPLAY",
  expectedWinnerCount: 2,
  actualWinnerCount: 2,
  winnerCountMatched: true,
  winnersUnique: true,
  candidatesMatched: true,
  exclusionsMatched: true,
  ranksMatched: true,
  snapshotHashMatched: true,
  inputHashMatched: true,
  resultHashMatched: true,
  algorithmMatched: true,
  failureCode: null,
};

test("원본 Seed 재현 일치 여부는 결과 Hash로만 판정한다", () => {
  assert.equal(replaySameWinners(VERIFIED), "same");
  assert.equal(replaySameWinners({ ...VERIFIED, resultHashMatched: false }), "different");
  assert.equal(replaySameWinners({ ...VERIFIED, resultHashMatched: null }), "unknown");
});

test("독립 재실행의 순위 연속성이 깨져도 원본 Seed 재현은 동일로 본다", () => {
  const verification = {
    ...VERIFIED,
    status: "VERIFICATION_FAILED",
    ranksMatched: false,
    failureCode: "REPLAY_RESULT_INVALID",
  };
  assert.equal(replaySameWinners(verification), "same");
  const byKey = Object.fromEntries(
    verificationChecks(verification).map((check) => [check.key, check.state]),
  );
  assert.equal(byKey.seedReplay, "pass");
  assert.equal(byKey.rankContinuity, "fail");
});

test("LEGACY_INTEGRITY 이력은 재현 항목이 없어 판정하지 않는다", () => {
  const legacy = { status: "VERIFIED", verificationMode: "LEGACY_INTEGRITY" };
  assert.equal(replaySameWinners(legacy), "unknown");
  assert.deepEqual(verificationChecks(legacy), []);
});

test("검증 완료 이력은 모든 체크 항목이 통과로 표시된다", () => {
  const checks = verificationChecks(VERIFIED);
  assert.ok(checks.every((check) => check.state === "pass"));
  assert.equal(checks.find((check) => check.key === "winnerCount").detail, "기대 2명 / 재실행 2명");
});

test("결정적 재현 실패 시 독립 재실행 항목은 미확인으로 남는다", () => {
  const verification = {
    ...VERIFIED,
    status: "VERIFICATION_FAILED",
    resultHashMatched: false,
    winnerCountMatched: null,
    winnersUnique: null,
    candidatesMatched: null,
    exclusionsMatched: null,
    ranksMatched: null,
    failureCode: "DETERMINISTIC_REPLAY_MISMATCH",
  };
  assert.equal(replaySameWinners(verification), "different");
  const byKey = Object.fromEntries(
    verificationChecks(verification).map((check) => [check.key, check.state]),
  );
  assert.equal(byKey.seedReplay, "fail");
  assert.equal(byKey.rankContinuity, "unknown");
  assert.equal(byKey.candidates, "unknown");
});

test("재현 당첨자 목록이 없으면 비교하지 않는다", () => {
  assert.equal(compareWinners([{ rankInDrawing: 1, userId: 1 }], null), null);
  assert.equal(compareWinners([], undefined), null);
  assert.equal(compareWinners(undefined, [{ rankInDrawing: 1, userId: 1 }]), null);
});

test("순위별로 최초·재현 당첨자를 비교하고 일치율을 계산한다", () => {
  const original = [
    { rankInDrawing: 1, userId: 18, prizeKey: "FIRST" },
    { rankInDrawing: 2, userId: 25, prizeKey: "SECOND" },
  ];
  const replayed = [
    { rankInDrawing: 1, userId: 18, prizeKey: "FIRST" },
    { rankInDrawing: 2, userId: 30, prizeKey: "SECOND" },
  ];
  const result = compareWinners(original, replayed);
  assert.equal(result.matched, 1);
  assert.equal(result.total, 2);
  assert.equal(result.rate, 50);
  assert.deepEqual(result.rows.map((row) => row.matched), [true, false]);
});

test("상품이 다르거나 한쪽에만 있는 순위는 불일치로 본다", () => {
  const result = compareWinners(
    [
      { rankInDrawing: 1, userId: 1, prizeKey: "FIRST" },
      { rankInDrawing: 2, userId: 2, prizeKey: "SECOND" },
    ],
    [{ rankInDrawing: 1, userId: 1, prizeKey: "SECOND" }],
  );
  assert.deepEqual(result.rows.map((row) => row.matched), [false, false]);
  assert.equal(result.rate, 0);
});

test("한쪽에만 상품이 있으면 불일치, 둘 다 없으면 사용자만 비교한다", () => {
  const oneSided = compareWinners(
    [{ rankInDrawing: 1, userId: 1, prizeKey: "FIRST" }],
    [{ rankInDrawing: 1, userId: 1, prizeKey: null }],
  );
  assert.equal(oneSided.rate, 0);
  const noPrize = compareWinners(
    [{ rankInDrawing: 1, userId: 1, prizeKey: null }],
    [{ rankInDrawing: 1, userId: 1 }],
  );
  assert.equal(noPrize.rate, 100);
});
