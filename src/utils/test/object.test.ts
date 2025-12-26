import { beforeEach, describe, expect, it } from 'bun:test';

import { deepClone, isObjectEmpty, mergeObjects, omit, pick } from '../object';

describe("Object Utilities", () => {
  describe("pick", () => {
    it("should pick specified keys from object", () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = pick(obj, ["a", "c"]);

      expect(result).toEqual({ a: 1, c: 3 });
      expect(Object.keys(result)).toHaveLength(2);
    });

    it("should return empty object when picking no keys", () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = pick(obj, []);

      expect(result).toEqual({});
    });

    it("should handle non-existent keys gracefully", () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, ["a", "c" as keyof typeof obj]);

      // @ts-ignore
      expect(result).toEqual({ a: 1 });
    });

    it("should pick all keys when all specified", () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = pick(obj, ["a", "b", "c"]);

      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("should handle objects with different value types", () => {
      const obj = { name: "test", age: 25, active: true, data: null };
      const result = pick(obj, ["name", "active"]);

      expect(result).toEqual({ name: "test", active: true });
    });
  });

  describe("omit", () => {
    it("should omit specified keys from object", () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = omit(obj, ["b", "d"]);

      expect(result).toEqual({ a: 1, c: 3 });
      expect(Object.keys(result)).toHaveLength(2);
    });

    it("should return same object when omitting no keys", () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = omit(obj, []);

      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("should handle non-existent keys gracefully", () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, ["c" as keyof typeof obj]);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it("should omit all keys when all specified", () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, ["a", "b"]);

      expect(result).toEqual({});
    });

    it("should not modify original object", () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = omit(obj, ["b"]);

      expect(obj).toEqual({ a: 1, b: 2, c: 3 });
      expect(result).toEqual({ a: 1, c: 3 });
    });
  });

  describe("isObjectEmpty", () => {
    it("should return true for empty object", () => {
      const obj = {};
      expect(isObjectEmpty(obj)).toBe(true);
    });

    it("should return false for non-empty object", () => {
      const obj = { a: 1 };
      expect(isObjectEmpty(obj)).toBe(false);
    });

    it("should return false for object with multiple keys", () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(isObjectEmpty(obj)).toBe(false);
    });

    it("should return false for object with null values", () => {
      const obj = { a: null, b: undefined };
      expect(isObjectEmpty(obj)).toBe(false);
    });
  });

  describe("deepClone", () => {
    it("should create a deep clone of an object", () => {
      const obj = { a: 1, b: { c: 2, d: 3 } };
      const clone = deepClone(obj);

      expect(clone).toEqual(obj);
      expect(clone).not.toBe(obj);
      expect(clone.b).not.toBe(obj.b);
    });

    it("should clone nested objects", () => {
      const obj = { a: 1, b: { c: 2, d: { e: 3 } } };
      const clone = deepClone(obj);

      clone.b.d.e = 99;

      expect(obj.b.d.e).toBe(3);
      expect(clone.b.d.e).toBe(99);
    });

    it("should clone arrays", () => {
      const obj = { a: [1, 2, 3], b: { c: [4, 5] } };
      const clone = deepClone(obj);

      expect(clone).toEqual(obj);
      expect(clone.a).not.toBe(obj.a);
      expect(clone.b.c).not.toBe(obj.b.c);
    });

    it("should handle primitive values", () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone("test")).toBe("test");
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
    });

    it("should clone dates as ISO strings", () => {
      const date = new Date("2024-01-01");
      const obj = { date };
      const clone = deepClone(obj);

      expect(typeof clone.date).toBe("string");
    });
  });

  describe("mergeObjects", () => {
    it("should merge two objects", () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { c: 3, d: 4 };
      const result = mergeObjects(obj1, obj2);

      expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });

    it("should override properties from first object with second", () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 3, c: 4 };
      const result = mergeObjects(obj1, obj2);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("should handle empty objects", () => {
      const obj1 = {};
      const obj2 = { a: 1 };
      const result = mergeObjects(obj1, obj2);

      expect(result).toEqual({ a: 1 });
    });

    it("should not modify original objects", () => {
      const obj1 = { a: 1 };
      const obj2 = { b: 2 };
      const result = mergeObjects(obj1, obj2);

      result.a = 99;

      expect(obj1.a).toBe(1);
      expect(result.a).toBe(99);
    });

    it("should merge objects with different value types", () => {
      const obj1 = { name: "test", age: 25 };
      const obj2 = { active: true, data: null };
      const result = mergeObjects(obj1, obj2);

      expect(result).toEqual({ name: "test", age: 25, active: true, data: null });
    });
  });
});
