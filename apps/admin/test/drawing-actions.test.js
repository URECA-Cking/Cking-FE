import assert from "node:assert/strict";
import test from "node:test";
import { canRunInitialDrawing } from "../src/utils/drawingActions.js";

test("INITIAL Drawing이 없고 조회 오류가 없을 때만 최초 추첨을 실행할 수 있다", () => {
  assert.equal(
    canRunInitialDrawing({ drawing: null, drawingError: undefined, eventStatus: "CLOSED" }),
    true,
  );
  assert.equal(
    canRunInitialDrawing({ drawing: null, drawingError: "조회 실패", eventStatus: "CLOSED" }),
    false,
  );
  assert.equal(
    canRunInitialDrawing({ drawing: { drawingId: 1 }, drawingError: undefined, eventStatus: "CLOSED" }),
    false,
  );
});
