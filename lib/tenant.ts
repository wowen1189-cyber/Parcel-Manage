// Which company does a request belong to? Decided by the host name, before anyone signs in.
//   simreipm.parcelmanage.com -> "simreipm"
//   simreipm.localhost:3000   -> "simreipm"
//   parcelmanage.com, www.parcelmanage.com, localhost:3000 -> null (the main site)
//   anything else (e.g. a Vercel preview address) -> null; the app falls back to the user's company

const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;

export function isValidSubdomain(value: string): boolean {
  return SUBDOMAIN_PATTERN.test(value);
}

export function subdomainFromHost(host: string | null | undefined, rootDomain: string): string | null {
  if (!host) return null;
  const h = host.toLowerCase().trim();
  const root = rootDomain.toLowerCase().trim();
  if (h === root || h === `www.${root}`) return null;
  if (!h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -(root.length + 1));
  if (sub === "www" || sub.includes(".") || !isValidSubdomain(sub)) return null;
  return sub;
}

// Address of a company's own site, e.g. https://simreipm.parcelmanage.com/sign-in
export function companyUrl(subdomain: string, rootDomain: string, path = "/"): string {
  const local = rootDomain.startsWith("localhost");
  return `${local ? "http" : "https"}://${subdomain}.${rootDomain}${path}`;
}
