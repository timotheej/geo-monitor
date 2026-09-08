import { describe, expect, it } from "vitest";
import { normalizeUrl, sameSite, urlMatches } from "./url";

describe("normalizeUrl", () => {
  it("strips scheme, www, tracking params, fragment and trailing slash", () => {
    expect(normalizeUrl("https://www.rablab.ca/blog/loi-25/?utm_source=openai#top")).toBe("rablab.ca/blog/loi-25");
    expect(normalizeUrl("http://rablab.ca/blog/loi-25")).toBe("rablab.ca/blog/loi-25");
    expect(normalizeUrl("https://rablab.ca/")).toBe("rablab.ca");
  });
  it("keeps meaningful params, sorted", () => {
    expect(normalizeUrl("https://x.ca/p?b=2&a=1&utm_medium=x")).toBe("x.ca/p?a=1&b=2");
  });
  it("rejects non http", () => {
    expect(normalizeUrl("ftp://x.ca")).toBeNull();
    expect(normalizeUrl("pas une url")).toBeNull();
  });
});

describe("urlMatches / sameSite", () => {
  it("matches variants of the same page", () => {
    expect(urlMatches("https://www.rablab.ca/blog/a/?utm_source=openai", "http://rablab.ca/blog/a")).toBe(true);
    expect(urlMatches("https://rablab.ca/blog/a", "https://rablab.ca/blog/b")).toBe(false);
  });
  it("detects same site including subdomains", () => {
    expect(sameSite("https://blog.rablab.ca/x", "rablab.ca")).toBe(true);
    expect(sameSite("https://notrablab.ca/x", "rablab.ca")).toBe(false);
  });
});
