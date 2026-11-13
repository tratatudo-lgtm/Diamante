import { describe, expect, test } from "bun:test";
import { isOtpActive } from "./otp-session.ts";

describe("isOtpActive", () => {
  test("aceita um OTP antes da expiração", () => {
    expect(isOtpActive(2000, 1999)).toBe(true);
  });

  test("rejeita um OTP no instante exato da expiração", () => {
    expect(isOtpActive(2000, 2000)).toBe(false);
  });

  test("rejeita um OTP expirado", () => {
    expect(isOtpActive(1999, 2000)).toBe(false);
  });

  test("rejeita valores ausentes, inválidos ou não finitos", () => {
    expect(isOtpActive(undefined, 1000)).toBe(false);
    expect(isOtpActive(null, 1000)).toBe(false);
    expect(isOtpActive("2000", 1000)).toBe(false);
    expect(isOtpActive(Number.NaN, 1000)).toBe(false);
    expect(isOtpActive(Number.POSITIVE_INFINITY, 1000)).toBe(false);
    expect(isOtpActive(2000, Number.NaN)).toBe(false);
  });
});
