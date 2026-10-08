import assert from "node:assert/strict";
import test from "node:test";
import { createIdempotencyKey, createUuidV4 } from "../src/utils/redrawRequest.js";

test("randomUUID를 사용할 수 없으면 UUID v4 형식의 멱등키를 생성한다", () => {
  const key = createUuidV4({
    getRandomValues(bytes) {
      bytes.fill(0);
      return bytes;
    },
  });

  assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("randomUUID가 있으면 해당 UUID를 멱등키로 사용한다", () => {
  assert.equal(
    createIdempotencyKey({ randomUUID: () => "1c2a89e6-0c56-4d57-8cfa-02c8d0cb70dd" }),
    "1c2a89e6-0c56-4d57-8cfa-02c8d0cb70dd",
  );
});
