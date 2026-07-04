// Pure IP-in-CIDR matching (IPv4 + IPv6). No I/O — safe for the edge middleware.

function parseV4(s: string): bigint | null {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  let v = 0n;
  for (let i = 1; i <= 4; i++) {
    const o = Number(m[i]);
    if (o > 255) return null;
    v = (v << 8n) | BigInt(o);
  }
  return v;
}

function parseV6(input: string): bigint | null {
  let s = input;
  // Embedded IPv4 tail, e.g. ::ffff:1.2.3.4
  if (s.includes(".")) {
    const idx = s.lastIndexOf(":");
    const v4 = parseV4(s.slice(idx + 1));
    if (v4 === null) return null;
    const hi = Number((v4 >> 16n) & 0xffffn);
    const lo = Number(v4 & 0xffffn);
    s = `${s.slice(0, idx + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 && head.length !== 8) return null;
  if (missing < 0) return null;
  const groups = [
    ...head,
    ...(halves.length === 2 ? Array<string>(missing).fill("0") : []),
    ...tail,
  ];
  if (groups.length !== 8) return null;
  let v = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    v = (v << 16n) | BigInt(Number.parseInt(g, 16));
  }
  return v;
}

/** True if `ip` falls within `cidr` (both must be the same family). Never throws. */
export function ipInCidr(ip: string, cidr: string): boolean {
  const slash = cidr.lastIndexOf("/");
  if (slash < 0) return false;
  const base = cidr.slice(0, slash);
  const prefix = Number(cidr.slice(slash + 1));
  const isV6 = cidr.includes(":");
  const bits = isV6 ? 128 : 32;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false;

  const ipVal = isV6 ? parseV6(ip) : parseV4(ip);
  const baseVal = isV6 ? parseV6(base) : parseV4(base);
  if (ipVal === null || baseVal === null) return false;

  const mask =
    prefix === 0 ? 0n : ((1n << BigInt(bits)) - 1n) ^ ((1n << BigInt(bits - prefix)) - 1n);
  return (ipVal & mask) === (baseVal & mask);
}
