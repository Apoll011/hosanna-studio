import assert from "node:assert/strict";
import test from "node:test";

import { generateDemoData } from "./demoData";

test("demo data includes three collections with the requested sizes", () => {
  const data = generateDemoData("en");

  assert.equal(data.collections.length, 3);
  assert.equal(data.collections[0].songIds?.length, 10);
  assert.equal(data.collections[1].songIds?.length, 10);
  assert.equal(data.collections[2].songIds?.length, 3);
  assert.ok(data.collections.every((collection) => collection.id));
});
