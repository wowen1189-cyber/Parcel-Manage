import { describe, expect, it } from "vitest";
import { deductionPrompt, defaultRooms, fallbackSuggestions, parseSuggestions, worsenedRooms, type Room } from "@/lib/inspections";

const room = (r: string, condition: Room["condition"], notes = ""): Room => ({ id: r, room: r, condition, notes, photos: [] });

describe("inspections", () => {
  it("starts with the home's rooms, one per bedroom and bathroom", () => {
    const rooms = defaultRooms(["Kitchen", "Living room", "Bedroom", "Bathroom", "Exterior / yard"], 3, 2);
    expect(rooms.map((r) => r.room)).toEqual(["Kitchen", "Living room", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bathroom 1", "Bathroom 2", "Exterior / yard"]);
    expect(rooms.every((r) => r.condition === "good")).toBe(true);
  });

  it("finds rooms that got worse, ignoring normal wear", () => {
    const moveIn = [room("Kitchen", "good"), room("Bedroom 1", "good"), room("Bathroom", "fair", "old caulk")];
    const moveOut = [room("Kitchen", "damaged", "burn mark on counter"), room("Bedroom 1", "fair", "light scuffs"), room("Bathroom", "fair"), room("Garage", "missing", "remote missing")];
    const changes = worsenedRooms(moveIn, moveOut);
    expect(changes.map((c) => c.room)).toEqual(["Kitchen", "Garage"]);
    expect(changes[1].before).toBeNull();
  });

  it("without AI, lists each changed room for the office to price", () => {
    const s = fallbackSuggestions(worsenedRooms([room("Kitchen", "good")], [room("Kitchen", "damaged", "burn mark on counter")]));
    expect(s).toEqual([{ description: "Kitchen: burn mark on counter", amount_cents: 0, reason: "Good at move-in, damaged at move-out." }]);
  });

  it("reads the AI's JSON, even in a code block, and rejects anything else", () => {
    expect(parseSuggestions('```json\n[{"description":"Replace counter section","amount_cents":45000,"reason":"Burn beyond normal wear."}]\n```')).toEqual([
      { description: "Replace counter section", amount_cents: 45000, reason: "Burn beyond normal wear." },
    ]);
    expect(parseSuggestions("[]")).toEqual([]);
    expect(parseSuggestions("I can't help")).toBeNull();
    expect(parseSuggestions('[{"description":"x","amount_cents":-5,"reason":""}]')).toBeNull();
  });

  it("tells the AI the facts without names", () => {
    const p = deductionPrompt({ months: 24, changes: worsenedRooms([room("Kitchen", "good")], [room("Kitchen", "damaged", "burn mark")]), moveOutNotes: "" });
    expect(p).toContain("Tenancy length: 24 months.");
    expect(p).toContain("Kitchen: move-in Good; move-out Damaged (burn mark)");
  });
});
