import { describe, expect, it } from "vitest";
import { acquireCreatorScrapeLock, releaseCreatorScrapeLock } from "@/lib/scrapeLocks";

describe("scrape locks", () => {
  it("prevents overlapping lock acquisition for same key", () => {
    const key = `scrape:${Date.now()}`;
    expect(acquireCreatorScrapeLock(key, 60_000)).toBe(true);
    expect(acquireCreatorScrapeLock(key, 60_000)).toBe(false);
    releaseCreatorScrapeLock(key);
    expect(acquireCreatorScrapeLock(key, 60_000)).toBe(true);
  });
});
