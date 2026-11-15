import test from "node:test";
import assert from "node:assert/strict";
import { createLatestRequest } from "../src/lib/latest-request.ts";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("a slow older response cannot overwrite the newest snapshot", async () => {
  const first = deferred(),
    second = deferred(),
    published = [];
  let calls = 0;
  const loader = createLatestRequest(
    () => (++calls === 1 ? first.promise : second.promise),
    (value) => published.push(value),
    assert.fail,
  );
  const older = loader.run(),
    newer = loader.run();
  second.resolve("new");
  await newer;
  first.resolve("old");
  await older;
  assert.deepEqual(published, ["new"]);
});

test("an obsolete error cannot disconnect a successful refresh", async () => {
  const first = deferred(),
    second = deferred(),
    errors = [];
  let calls = 0;
  const loader = createLatestRequest(
    () => (++calls === 1 ? first.promise : second.promise),
    () => {},
    (error) => errors.push(error),
  );
  const older = loader.run(),
    newer = loader.run();
  second.resolve("new");
  await newer;
  first.reject(new Error("old failure"));
  await older;
  assert.deepEqual(errors, []);
});

test("a failed refresh preserves the last published data and can recover", async () => {
  const published = [],
    errors = [];
  let calls = 0;
  const loader = createLatestRequest(
    async () => {
      if (++calls === 2) throw new Error("offline");
      return calls;
    },
    (value) => published.push(value),
    (error) => errors.push(error.message),
  );
  await loader.run();
  await loader.run();
  assert.deepEqual(published, [1]);
  assert.deepEqual(errors, ["offline"]);
  await loader.run();
  assert.deepEqual(published, [1, 3]);
});

test("cancellation aborts the request and suppresses updates after unmount", async () => {
  const pending = deferred();
  let signal;
  const loader = createLatestRequest(
    (s) => {
      signal = s;
      return pending.promise;
    },
    assert.fail,
    assert.fail,
  );
  const request = loader.run();
  loader.cancel();
  assert.equal(signal.aborted, true);
  pending.resolve("ignored");
  await request;
});
