import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { getClientIp, hashIp } from "./request-ip";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://example.com/api/feedback", { headers });
}

describe("getClientIp", () => {
  it("takes the first address from x-forwarded-for", () => {
    const ip = getClientIp(makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }));
    expect(ip).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const ip = getClientIp(makeRequest({ "x-real-ip": "9.8.7.6" }));
    expect(ip).toBe("9.8.7.6");
  });

  it("returns unknown when neither is present", () => {
    const ip = getClientIp(makeRequest({}));
    expect(ip).toBe("unknown");
  });
});

describe("hashIp", () => {
  it("hashes the same input to the same value", async () => {
    const a = await hashIp("1.2.3.4");
    const b = await hashIp("1.2.3.4");
    expect(a).toBe(b);
  });

  it("hashes different inputs differently and never contains the raw IP", async () => {
    const a = await hashIp("1.2.3.4");
    const b = await hashIp("4.3.2.1");
    expect(a).not.toBe(b);
    expect(a).not.toContain("1.2.3.4");
  });
});
