import { describe, expect, test } from "bun:test";
import { isSocketTokenActive } from "./socket-session.ts";

describe("isSocketTokenActive", () => {
  test("aceita uma sessão ainda válida", () => {
    expect(isSocketTokenActive(2000, 1000)).toBe(true);
  });

  test("rejeita uma sessão expirada", () => {
    expect(isSocketTokenActive(999, 1000)).toBe(false);
  });

  test("rejeita uma sessão no instante exato da expiração", () => {
    expect(isSocketTokenActive(1000, 1000)).toBe(false);
  });

  test("rejeita valores ausentes ou de tipo incorreto", () => {
    expect(isSocketTokenActive(undefined, 1000)).toBe(false);
    expect(isSocketTokenActive(null, 1000)).toBe(false);
    expect(isSocketTokenActive("2000", 1000)).toBe(false);
  });

  test("rejeita valores numéricos não finitos", () => {
    expect(isSocketTokenActive(Number.NaN, 1000)).toBe(false);
    expect(isSocketTokenActive(Number.POSITIVE_INFINITY, 1000)).toBe(false);
    expect(isSocketTokenActive(Number.NEGATIVE_INFINITY, 1000)).toBe(false);
  });
});
