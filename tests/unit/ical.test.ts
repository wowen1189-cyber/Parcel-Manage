import { describe, expect, it } from "vitest";
import { buildCalendar, conflicts, parseIcs } from "@/lib/ical";

const FEED = [
  "BEGIN:VCALENDAR",
  "X-WR-TIMEZONE:America/New_York",
  "BEGIN:VEVENT",
  "UID:a",
  "DTSTART;TZID=America/New_York:20261105T140000",
  "DTEND;TZID=America/New_York:20261105T150000",
  "SUMMARY:Dentist\\, downtown",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:b",
  "DTSTART:20261104T130000Z",
  "DTEND:20261104T140000Z",
  "RRULE:FREQ=WEEKLY;BYDAY=WE,FR;COUNT=4",
  "EXDATE:20261106T130000Z",
  "SUMMARY:Team call",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:c",
  "DTSTART;VALUE=DATE:20261110",
  "DTEND;VALUE=DATE:20261111",
  "SUMMARY:Out of office",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:d",
  "DTSTART:20261104T170000Z",
  "STATUS:CANCELLED",
  "SUMMARY:Canceled",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("calendar feeds", () => {
  const from = new Date("2026-11-02T00:00:00Z");
  const to = new Date("2026-11-16T00:00:00Z");

  it("reads timed, repeating and all-day events in the calendar's time zone, skipping cancellations and exceptions", () => {
    const e = parseIcs(FEED, from, to);
    expect(e.map((x) => `${x.title}@${x.start}`)).toEqual([
      "Team call@2026-11-04T13:00:00.000Z",
      "Dentist, downtown@2026-11-05T19:00:00.000Z",
      "Out of office@2026-11-10T00:00:00.000Z",
      "Team call@2026-11-11T13:00:00.000Z",
      "Team call@2026-11-13T13:00:00.000Z",
    ]);
    expect(e.find((x) => x.title === "Out of office")?.allDay).toBe(true);
  });

  it("finds a showing that overlaps a busy time, ignoring all-day events", () => {
    const e = parseIcs(FEED, from, to);
    expect(conflicts(e, new Date("2026-11-05T19:30:00Z"), new Date("2026-11-05T20:00:00Z")).map((x) => x.title)).toEqual(["Dentist, downtown"]);
    expect(conflicts(e, new Date("2026-11-10T15:00:00Z"), new Date("2026-11-10T15:30:00Z"))).toEqual([]);
  });

  it("writes a feed Google Calendar can subscribe to, escaping text and folding long lines", () => {
    const ics = buildCalendar(
      "Parcel Manage",
      [
        { uid: "wo-1@parcelmanage", title: "Repair visit: AC not cooling, 6 Forest Lane", start: "2026-11-05T14:00:00Z", end: "2026-11-05T16:00:00Z", location: "6 Forest Lane; Eustis" },
        { uid: "lease-1@parcelmanage", title: "Lease ends", start: "2026-12-31", allDay: true, description: "x".repeat(120) },
      ],
      new Date("2026-11-02T12:00:00Z"),
    );
    expect(ics).toContain("SUMMARY:Repair visit: AC not cooling\\, 6 Forest Lane");
    expect(ics).toContain("LOCATION:6 Forest Lane\\; Eustis");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    // Round trip: what we write, we can read.
    expect(parseIcs(ics, from, new Date("2027-01-02T00:00:00Z")).map((x) => x.title)).toEqual(["Repair visit: AC not cooling, 6 Forest Lane", "Lease ends"]);
  });
});
