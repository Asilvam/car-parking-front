import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("usa una entrada React y Vite tradicional", async () => {
  const [html, main, app] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(html, /src="\/src\/main\.tsx"/);
  assert.match(main, /createRoot/);
  assert.match(app, /import\.meta\.env\.VITE_API_URL/);
  assert.doesNotMatch(app, /next\/|process\.env|vinext/);
});
