// The tenant home-care guide: what tenants must do to keep their home in shape, and quick fixes to try
// before asking for a repair. Rebuilt from SIM REI's "Maintenance How-To's" PDF and the upkeep its lease
// requires (lease §3.2 and §3.7). Like DEFAULT_BUSINESS_RULES, SIM REI's wording and cost figures are the
// default; a company can replace the guide in its settings (company.settings.homeCareGuide).
// Shown on the public page /home-care (no sign-in, no private data) and, later, in the tenant portal.

export type CareStep = { text: string; tip?: string };
export type CareSection = {
  id: string;
  title: string;
  why?: string;
  steps?: CareStep[];
  doList?: string[];
  dontList?: string[];
  cost?: string;
  videoUrl?: string;
};
export type ChecklistItem = { every: "Monthly" | "Every 3 months" | "Every 6 months" | "Every quarter" | "Yearly"; text: string; appliesTo?: "single_family" };
export type HomeCareGuide = { intro: string; checklist: ChecklistItem[]; sections: CareSection[] };

export const DEFAULT_HOME_CARE: HomeCareGuide = {
  intro:
    "These are the routine jobs your lease asks you to do, plus a few quick fixes to try before you ask for a repair. They take minutes, prevent the most common breakdowns in Florida homes, and save you from repair charges.",
  checklist: [
    { every: "Monthly", text: "Pour 1–2 cups of white vinegar into the AC drain line." },
    { every: "Monthly", text: "Put in a new, clean AC air filter." },
    { every: "Monthly", text: "Test every smoke alarm and replace dead batteries." },
    { every: "Monthly", text: "Run hot tap water down slow drains." },
    { every: "Every 3 months", text: "Treat inside and around the outside for common pests (ants, roaches, spiders)." },
    { every: "Every 6 months", text: "Replace refrigerator and other water filters (or as the maker says)." },
    { every: "Every quarter", text: "Send your self-inspection photos in the first week of January, April, July and October." },
    { every: "Yearly", text: "Pressure wash walkways and driveway, and clean the gutters.", appliesTo: "single_family" },
  ],
  sections: [
    {
      id: "ac",
      title: "Air conditioning",
      why:
        "In Florida's heat and humidity, AC drain lines clog easily. A clogged line can trip the system, blow a part like the capacitor, or leak water, and leave you without cooling until a technician comes.",
      steps: [
        { text: "Turn the system off at the thermostat, then switch off its breaker.", tip: "Safety first: never pour anything into a running unit." },
        { text: "Find the drain line by the indoor unit: a white PVC pipe with a cap or open vent on top.", tip: "Pour into the open vent or cleanout, not into the unit itself." },
        { text: "Use a funnel to pour 1–2 cups of white vinegar into the line.", tip: "Don't use bleach. It eats away parts of the system." },
        { text: "Put in a new, clean air filter.", tip: "Do this every month. A 5-week-old filter is already gray and clogged." },
        { text: "Vacuum dust and cobwebs from the thermostat and the vent covers (supply and return)." },
        { text: "Turn the breaker and the thermostat back on." },
      ],
      cost: "Damage caused by skipping filter changes may be charged to you (lease §3.2).",
    },
    {
      id: "drains",
      title: "Drains and toilets",
      why: "Kitchen, bathroom and shower drains and toilets clog from grease, soap, hair and things that shouldn't be flushed.",
      steps: [
        { text: "Once a month, run the hottest tap water down each drain for a minute or two.", tip: "Hot tap water, not boiling: boiling water can crack a porcelain toilet and soften plastic pipes." },
        { text: "For hair clogs, use a plastic drain auger (hair clog tool).", tip: "Under $10 at Walmart, Lowe's, Home Depot or Amazon." },
      ],
      dontList: ["Wipes, even \"flushable\" ones", "Pads, tampons and other feminine products", "Diapers", "Dental floss", "Grease or cooking oil", "Coffee grounds", "Paper towels"],
      cost: "If a plumber has to snake a drain clogged by these, it costs about $250, charged to you (lease §3.2).",
    },
    {
      id: "pests",
      title: "Pests",
      why: "Your lease makes you responsible for general pest control from 30 days after move-in. Treat at least every 90 days.",
      steps: [
        { text: "Spray an indoor and perimeter insect killer as a preventive treatment, and whenever you see bugs.", tip: "Home Defense and similar sprays cost under $20 at Walmart, Lowe's, Home Depot or Amazon." },
        { text: "Knock down nests and hives under eaves, around carports, doorways and window frames." },
        { text: "Keep a safe distance from hives and nests, and read the whole label before using any pest product." },
        { text: "Tell us right away if you see rodents or bed bugs. Those need a professional." },
      ],
    },
    {
      id: "dishwasher",
      title: "Dishwasher",
      why: "Dishwasher pumps burn out from grease on pots, pans and plates.",
      steps: [{ text: "Scrape and wipe pots, pans and dishes before loading them." }],
      cost: "Replacing a dishwasher costs about $500.",
    },
    {
      id: "disposal",
      title: "Garbage disposal",
      steps: [
        { text: "Not turning on? Check its breaker, then press the red Reset button on the bottom of the disposal." },
        { text: "Only humming? It's jammed. Turn it off and submit a request. Never put your hand inside." },
        { text: "Run cold water for 10 seconds before and after each use, so scraps wash down and grease stays solid." },
      ],
      doList: ["Small soft food scraps, with cold running water", "A few ice cubes every other week (they clean the blades)", "Lemon or orange wedges to freshen it", "Dish soap or disposal cleaner to cut grease"],
      dontList: ["Coffee grounds (they form a thick paste)", "Grease and fat", "Eggshells (the inner skin wraps the blades)", "Onion skins and potato peels", "Bones, nuts and fruit pits", "Pasta, rice and oats (they swell and clog)"],
      cost: "Un-jamming a disposal costs about $150.",
    },
    {
      id: "smoke-alarms",
      title: "Smoke alarms",
      steps: [
        { text: "Press the test button on each alarm once a month. It should beep loudly." },
        { text: "Replace the battery if it chirps or doesn't sound." },
        { text: "Tell us right away if an alarm still doesn't work. Never disconnect one." },
      ],
    },
    {
      id: "self-inspection",
      title: "Quarterly self-inspection photos",
      why: "Instead of frequent in-person inspections, your lease asks for clear, dated photos once a quarter (first week of January, April, July and October).",
      steps: [
        { text: "Kitchen: stove, inside the refrigerator, under the sink." },
        { text: "Every bathroom: shower or tub, sink, toilet." },
        { text: "A close-up of the AC filter." },
        { text: "The water heater closet or laundry area." },
        { text: "Walls, for any signs of mold or moisture, and all floors." },
        { text: "Front and back yard, including grass, shrubs and fence (houses only)." },
      ],
      cost: "If photos aren't sent, we may inspect in person and charge a $75 inspection fee (lease §3.7).",
    },
  ],
};

export function readHomeCareGuide(settings: unknown): HomeCareGuide {
  const s = settings as { homeCareGuide?: HomeCareGuide } | null;
  return s?.homeCareGuide?.sections?.length ? s.homeCareGuide : DEFAULT_HOME_CARE;
}
