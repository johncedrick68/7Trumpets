import assert from "node:assert/strict";
import test from "node:test";

import { relationToMany, relationToOne } from "../src/lib/data/relations.ts";
import { formatMinorUnitsToPHP } from "../src/lib/money.ts";

test("one-to-one relations normalize object, null, and historical array forms", () => {
  const value = { id: "one" };
  assert.deepEqual(relationToOne(value), value);
  assert.equal(relationToOne(null), null);
  assert.equal(relationToOne(undefined), null);
  assert.deepEqual(relationToOne([value]), value);
  assert.equal(relationToOne([]), null);
  assert.throws(
    () => relationToOne([value, { id: "unexpected-second" }]),
    /Expected a to-one relation but received multiple records/,
  );
});

test("one-to-many relations normalize arrays, null, and historical object forms", () => {
  const value = { id: "many" };
  assert.deepEqual(relationToMany([value]), [value]);
  assert.deepEqual(relationToMany(null), []);
  assert.deepEqual(relationToMany(undefined), []);
  assert.deepEqual(relationToMany(value), [value]);
});

test("the canonical PHP formatter preserves exact minor units", () => {
  assert.equal(formatMinorUnitsToPHP(0), "₱0.00");
  assert.equal(formatMinorUnitsToPHP(299900), "₱2,999.00");
  assert.equal(formatMinorUnitsToPHP(-125), "-₱1.25");
});
