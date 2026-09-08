import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateIp } from "./net-guard";

describe("isPrivateIp", () => {
  it("flags private and special ranges", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "172.16.5.5", "172.31.255.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("accepts public addresses", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("rejects local hosts and credentials without DNS", async () => {
    await expect(assertPublicUrl(new URL("http://localhost/x"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("http://127.0.0.1/x"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("http://user:pw@example.com/"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("ftp://example.com/"))).rejects.toThrow();
  });
});
