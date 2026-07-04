import { describe, expect, it } from "vitest";
import { botVerified, ipInCidr, OPERATOR_RANGES, verifyBot } from "./index";

describe("ipInCidr", () => {
  it("matches IPv4 within/outside a range", () => {
    expect(ipInCidr("10.0.0.5", "10.0.0.0/24")).toBe(true);
    expect(ipInCidr("10.0.1.5", "10.0.0.0/24")).toBe(false);
    expect(ipInCidr("192.168.1.1", "192.168.0.0/16")).toBe(true);
    expect(ipInCidr("8.8.8.8", "0.0.0.0/0")).toBe(true);
  });

  it("matches IPv6 within/outside a range", () => {
    expect(ipInCidr("2001:4860:4801:10::1", "2001:4860:4801:10::/64")).toBe(true);
    expect(ipInCidr("2001:4860:4801:20::1", "2001:4860:4801:10::/64")).toBe(false);
  });

  it("returns false on family mismatch or garbage", () => {
    expect(ipInCidr("1.2.3.4", "2001:db8::/32")).toBe(false);
    expect(ipInCidr("not-an-ip", "10.0.0.0/8")).toBe(false);
  });
});

describe("verifyBot", () => {
  const googleV4 = (OPERATOR_RANGES.googlebot ?? []).filter((c) => !c.includes(":"))[0] ?? "";
  const googleIp = googleV4.split("/")[0] ?? "";

  it("verifies a real Googlebot claim from a Google IP", () => {
    expect(googleIp).not.toBe("");
    expect(verifyBot("Mozilla/5.0 (compatible; Googlebot/2.1)", googleIp).result).toBe("verified");
  });

  it("flags a Googlebot UA from a non-Google IP as spoofed", () => {
    const r = verifyBot(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "203.0.113.7",
    );
    expect(r).toEqual({ operator: "googlebot", result: "spoofed" });
  });

  it("is unverifiable for non-operator UAs and missing input", () => {
    expect(verifyBot("claude-code/2.1.201", "203.0.113.7").result).toBe("unverifiable");
    expect(verifyBot(null, "1.2.3.4").result).toBe("unverifiable");
    expect(verifyBot("Mozilla/5.0 (compatible; Googlebot/2.1)", null).result).toBe("unverifiable");
  });

  it("botVerified maps unverifiable → null, keeps verified/spoofed", () => {
    expect(botVerified("claude-code/2.1", "1.2.3.4")).toBeNull();
    expect(botVerified("Mozilla/5.0 (compatible; Googlebot/2.1)", "203.0.113.7")).toBe("spoofed");
    expect(botVerified("Mozilla/5.0 (compatible; Googlebot/2.1)", googleIp)).toBe("verified");
  });
});
