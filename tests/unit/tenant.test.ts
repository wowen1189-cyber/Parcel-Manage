import { describe, expect, it } from "vitest";
import { companyUrl, isValidSubdomain, subdomainFromHost } from "@/lib/tenant";

describe("subdomainFromHost", () => {
  it("reads the company from a production subdomain", () => {
    expect(subdomainFromHost("simreipm.parcelmanage.com", "parcelmanage.com")).toBe("simreipm");
    expect(subdomainFromHost("SimREIpm.ParcelManage.com", "parcelmanage.com")).toBe("simreipm");
  });

  it("reads the company from a local subdomain", () => {
    expect(subdomainFromHost("simreipm.localhost:3000", "localhost:3000")).toBe("simreipm");
  });

  it("treats the main site and www as no company", () => {
    expect(subdomainFromHost("parcelmanage.com", "parcelmanage.com")).toBeNull();
    expect(subdomainFromHost("www.parcelmanage.com", "parcelmanage.com")).toBeNull();
    expect(subdomainFromHost("localhost:3000", "localhost:3000")).toBeNull();
  });

  it("ignores other hosts, nested subdomains and bad names", () => {
    expect(subdomainFromHost("parcel-manage-abc123-parcel7.vercel.app", "parcelmanage.com")).toBeNull();
    expect(subdomainFromHost("a.b.parcelmanage.com", "parcelmanage.com")).toBeNull();
    expect(subdomainFromHost("-bad.parcelmanage.com", "parcelmanage.com")).toBeNull();
    expect(subdomainFromHost("evilparcelmanage.com", "parcelmanage.com")).toBeNull();
    expect(subdomainFromHost(null, "parcelmanage.com")).toBeNull();
  });
});

describe("isValidSubdomain", () => {
  it("allows lowercase letters, numbers and inner hyphens", () => {
    expect(isValidSubdomain("simreipm")).toBe(true);
    expect(isValidSubdomain("sim-rei-2")).toBe(true);
    expect(isValidSubdomain("Sim")).toBe(false);
    expect(isValidSubdomain("sim rei")).toBe(false);
    expect(isValidSubdomain("sim-")).toBe(false);
    expect(isValidSubdomain("")).toBe(false);
  });
});

describe("companyUrl", () => {
  it("uses https in production and http locally", () => {
    expect(companyUrl("simreipm", "parcelmanage.com", "/dashboard")).toBe("https://simreipm.parcelmanage.com/dashboard");
    expect(companyUrl("simreipm", "localhost:3000")).toBe("http://simreipm.localhost:3000/");
  });
});

describe("authCookieOptions", () => {
  it("shares the cookie across parcelmanage.com subdomains only when on that domain", async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "parcelmanage.com";
    const { vi } = await import("vitest");
    vi.resetModules();
    const { authCookieOptions } = await import("@/lib/supabase/cookie-options");
    expect(authCookieOptions("simreipm.parcelmanage.com")?.domain).toBe(".parcelmanage.com");
    expect(authCookieOptions("parcelmanage.com")?.domain).toBe(".parcelmanage.com");
    expect(authCookieOptions("parcel-manage-git-main-parcel7.vercel.app")).toBeUndefined();
    expect(authCookieOptions("evilparcelmanage.com")).toBeUndefined();
  });
});
