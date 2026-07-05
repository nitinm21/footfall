import { describe, expect, it } from "vitest";
import { applyCap } from "./cap";

describe("applyCap", () => {
  it("accepts everything when uncapped (cap <= 0)", () => {
    expect(applyCap(9999, 5, 0)).toEqual({ accept: 5, drop: 0 });
  });
  it("accepts the whole batch under the cap", () => {
    expect(applyCap(10, 5, 100)).toEqual({ accept: 5, drop: 0 });
  });
  it("partially accepts at the boundary", () => {
    expect(applyCap(98, 5, 100)).toEqual({ accept: 2, drop: 3 });
  });
  it("drops the whole batch once at/over the cap", () => {
    expect(applyCap(100, 5, 100)).toEqual({ accept: 0, drop: 5 });
    expect(applyCap(120, 5, 100)).toEqual({ accept: 0, drop: 5 });
  });
});
