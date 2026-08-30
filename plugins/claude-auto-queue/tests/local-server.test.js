import assert from "node:assert/strict";
import test from "node:test";

import {
  isTrustedApiMutationHeaders,
  isTrustedHostHeader
} from "../src/core/local-server.js";

test("localhost server accepts only its canonical host header", () => {
  assert.equal(isTrustedHostHeader("127.0.0.1:19741"), true);
  assert.equal(isTrustedHostHeader("localhost:19741"), false);
  assert.equal(isTrustedHostHeader("evil.example"), false);
  assert.equal(isTrustedHostHeader(undefined), false);
});

test("local API mutations require JSON and reject cross-site browser requests", () => {
  const base = {
    host: "127.0.0.1:19741",
    "content-type": "application/json; charset=utf-8"
  };

  assert.equal(isTrustedApiMutationHeaders(base), true);
  assert.equal(
    isTrustedApiMutationHeaders({ ...base, origin: "http://127.0.0.1:19741", "sec-fetch-site": "same-origin" }),
    true
  );
  assert.equal(
    isTrustedApiMutationHeaders({ ...base, origin: "https://attacker.example", "sec-fetch-site": "cross-site" }),
    false
  );
  assert.equal(
    isTrustedApiMutationHeaders({ ...base, "content-type": "application/x-www-form-urlencoded" }),
    false
  );
  assert.equal(
    isTrustedApiMutationHeaders({ ...base, host: "attacker.example" }),
    false
  );
});
