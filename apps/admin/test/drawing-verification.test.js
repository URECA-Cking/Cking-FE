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

test("순위와 결과 Hash가 모두 일치하면 최초 당첨자와 동일하다고 판정한다", () => {
  assert.equal(replaySameWinners(VERIFIED), "same");
  assert.equal(replaySameWinners({ ...VERIFIED, ranksMatched: false }), "different");
  assert.equal(replaySameWinners({ ...VERIFIED, resultHashMatched: null }), "unknown");
});

test("LEGACY_INTEGRITY 이력은 재현 항목이 없어 판정하지 않는다", () => {
  const legacy = { status: "VERIFIED", verificationMode: "LEGACY_INTEGRITY" };
  assert.equal(replaySameWinners(legacy), "unknown");
  assert.deepEqual(verificationChecks(legacy), []);
});

test("검증 완료 이력은 모든 체크 항목이 통과로 표시된다", () => {
  const checks = verificationChecks(VERIFIED);
  assert.ok(checks.every((check) => check.state === "pass"));
  assert.equal(checks.find((check) => check.key === "winnerCount").detail, "기대 2명 / 재현 2명");
});

test("실패 이력은 실패한 항목과 미실행 항목을 구분한다", () => {
  const checks = verificationChecks({
    ...VERIFIED,
    status: "VERIFICATION_FAILED",
    ranksMatched: false,
    resultHashMatched: null,
    failureCode: "DETERMINISTIC_REPLAY_MISMATCH",
  });
  const byKey = Object.fromEntries(checks.map((check) => [check.key, check.state]));
  assert.equal(byKey.seedReplay, "fail");
  assert.equal(byKey.resultHash, "unknown");
  assert.equal(byKey.independentReplay, "unknown");
});

test("재현 당첨자 목록이 없으면 비교하지 않는다", () => {
  assert.equal(compareWinners([{ rankInDrawing: 1, userId: 1 }], null), null);
  assert.equal(compareWinners([], undefined), null);
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

test("상품 정보가 null이면 사용자만 비교한다", () => {
  const result = compareWinners(
    [{ rankInDrawing: 1, userId: 1, prizeKey: "FIRST" }],
    [{ rankInDrawing: 1, userId: 1, prizeKey: null }],
  );
  assert.equal(result.rate, 100);
});
