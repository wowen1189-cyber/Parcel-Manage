// iCalendar (RFC 5545) for the self-serve calendar connection, kept pure for tests.
// Out: each staff member's private subscription feed of Parcel Manage dates (Google Calendar → "From URL").
// In: a calendar's secret iCal address (Google Calendar → "Secret address in iCal format"), read for showing
// the events next to Parcel Manage's and spotting double-booked showings. Repeating events are expanded for
// the common rules (daily, weekly by day, monthly, yearly; interval, count, until, exceptions).

export type CalEvent = { uid: string; title: string; start: string; end?: string | null; allDay?: boolean; location?: string | null; description?: string | null; url?: string | null };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

/** Lines over 75 octets are folded with CRLF + space (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildCalendar(name: string, events: CalEvent[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Parcel Manage//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utc(now.toISOString())}`);
    if (e.allDay) {
      const next = new Date(`${e.start.slice(0, 10)}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${day(e.start)}`, `DTEND;VALUE=DATE:${day(e.end ?? next.toISOString())}`);
    } else {
      lines.push(`DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end ?? new Date(new Date(e.start).getTime() + 3_600_000).toISOString())}`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

type Prop = { name: string; params: Record<string, string>; value: string };

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  const i = line.indexOf(":");
  if (i < 0) return null;
  const [name, ...params] = line.slice(0, i).split(";");
  return { name: name.toUpperCase(), params: Object.fromEntries(params.map((p) => p.split("=") as [string, string]).map(([k, v]) => [k.toUpperCase(), (v ?? "").replace(/^"|"$/g, "")])), value: line.slice(i + 1) };
}

const unesc = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

/** Local wall time in an IANA zone → UTC (two passes handle the DST edge). */
function zoned(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  let t = guess - offset(guess);
  t = guess - offset(t);
  return new Date(t);
}

/** A DTSTART/DTEND value: UTC ("Z"), local in TZID (or the calendar's zone), or a date (all day). */
export function parseDate(p: Prop, fallbackTz: string): { date: Date; allDay: boolean } | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h || p.params.VALUE === "DATE") return { date: new Date(Date.UTC(+y, +mo - 1, +d)), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
  const tz = p.params.TZID && isZone(p.params.TZID) ? p.params.TZID : fallbackTz;
  return { date: zoned(+y, +mo, +d, +h, +mi, +s, tz), allDay: false };
}

function isZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Start times of a repeating event inside [from, to). */
function occurrences(start: Date, rrule: string, exdates: Set<number>, from: Date, to: Date): Date[] {
  const r = Object.fromEntries(rrule.split(";").map((kv) => kv.split("=") as [string, string]));
  const freq = r.FREQ;
  const interval = Math.max(1, Number(r.INTERVAL ?? 1));
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? parseDate({ name: "UNTIL", params: {}, value: r.UNTIL }, "UTC")?.date ?? null : null;
  const byDay = r.BYDAY ? r.BYDAY.split(",").map((d) => DAYS.indexOf(d.slice(-2))).filter((d) => d >= 0) : [];
  const out: Date[] = [];
  let n = 0;
  const add = (d: Date) => {
    n++;
    if (d >= from && d < to && !exdates.has(d.getTime())) out.push(d);
  };
  const past = (d: Date) => (until && d > until) || n >= count || d >= to;
  if (freq === "WEEKLY" && byDay.length) {
    const weekStart = new Date(start.getTime() - start.getUTCDay() * 86_400_000);
    for (let w = 0; w < 2000; w += interval) {
      for (const dow of [...byDay].sort()) {
        const d = new Date(weekStart.getTime() + (w * 7 + dow) * 86_400_000);
        if (d < start) continue;
        if (past(d)) return out;
        add(d);
      }
    }
    return out;
  }
  for (let i = 0; i < 5000; i++) {
    const d = new Date(start);
    if (freq === "DAILY") d.setUTCDate(d.getUTCDate() + i * interval);
    else if (freq === "WEEKLY") d.setUTCDate(d.getUTCDate() + i * 7 * interval);
    else if (freq === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + i * interval);
    else if (freq === "YEARLY") d.setUTCFullYear(d.getUTCFullYear() + i * interval);
    else return i === 0 ? [start].filter((x) => x >= from && x < to) : out;
    if (past(d)) return out;
    add(d);
  }
  return out;
}

export type BusyEvent = { title: string; start: string; end: string; allDay: boolean; location: string | null };

/** Events from an iCal feed that overlap [from, to), with repeating events expanded. */
export function parseIcs(text: string, from: Date, to: Date, fallbackTz = "America/New_York"): BusyEvent[] {
  const calTz = unfold(text).map(parseLine).find((p) => p?.name === "X-WR-TIMEZONE")?.value.trim();
  const tz = calTz && isZone(calTz) ? calTz : fallbackTz;
  const events: BusyEvent[] = [];
  let cur: Prop[] | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") cur = [];
    else if (line === "END:VEVENT" && cur) {
      const get = (n: string) => cur!.find((p) => p.name === n);
      const all = (n: string) => cur!.filter((p) => p.name === n);
      const s = get("DTSTART") ? parseDate(get("DTSTART")!, tz) : null;
      if (s && get("STATUS")?.value !== "CANCELLED" && !get("RECURRENCE-ID")) {
        const e = get("DTEND") ? parseDate(get("DTEND")!, tz) : null;
        const length = e ? e.date.getTime() - s.date.getTime() : s.allDay ? 86_400_000 : 3_600_000;
        const exdates = new Set(all("EXDATE").flatMap((p) => p.value.split(",").map((v) => parseDate({ ...p, value: v }, tz)?.date.getTime() ?? 0)));
        const rrule = get("RRULE")?.value;
        const starts = rrule ? occurrences(s.date, rrule, exdates, new Date(from.getTime() - length), to) : [s.date].filter((d) => d.getTime() + length > from.getTime() && d < to);
        for (const st of starts) events.push({ title: unesc(get("SUMMARY")?.value ?? "Busy"), start: st.toISOString(), end: new Date(st.getTime() + length).toISOString(), allDay: s.allDay, location: get("LOCATION") ? unesc(get("LOCATION")!.value) : null });
      }
      cur = null;
    } else if (cur) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

/** Busy (timed) events that overlap [start, end). */
export function conflicts<T extends BusyEvent>(events: T[], start: Date, end: Date): T[] {
  return events.filter((e) => !e.allDay && new Date(e.start) < end && new Date(e.end) > start);
}
