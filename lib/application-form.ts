// Rental application questions. The unit decides which set is used (residential or commercial), never the
// applicant. Same questions for everyone (Fair Housing Act): nothing about race, color, religion, sex,
// national origin, disability or familial status beyond the occupancy count. Social Security numbers and
// dates of birth go only to the screening company, never here.

export type Question = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "money" | "number" | "date" | "textarea" | "select";
  required?: boolean;
  hint?: string;
  options?: string[];
};
export type Section = { title: string; questions: Question[] };

const contact: Section = {
  title: "About you",
  questions: [
    { name: "first_name", label: "First name", type: "text", required: true },
    { name: "last_name", label: "Last name", type: "text", required: true },
    { name: "email", label: "E-mail", type: "email", required: true },
    { name: "phone", label: "Mobile phone", type: "tel", required: true },
  ],
};

export const RESIDENTIAL: Section[] = [
  contact,
  {
    title: "Where you live now",
    questions: [
      { name: "current_address", label: "Current address", type: "text", required: true },
      { name: "current_since", label: "Lived there since", type: "date" },
      { name: "current_rent", label: "Current rent ($/month)", type: "money", hint: "Leave blank if you own or don't pay rent." },
      { name: "landlord_name", label: "Current landlord or manager", type: "text" },
      { name: "landlord_phone", label: "Their phone", type: "tel" },
      { name: "reason_for_moving", label: "Why are you moving?", type: "text" },
    ],
  },
  {
    title: "Income",
    questions: [
      { name: "employer", label: "Employer", type: "text", hint: "Or 'Self-employed', 'Retired', etc." },
      { name: "job_title", label: "Job title", type: "text" },
      { name: "employer_phone", label: "Employer phone", type: "tel" },
      { name: "monthly_income", label: "Your gross monthly income ($)", type: "money", required: true, hint: "Before taxes. Include every source: work, benefits, support, retirement." },
    ],
  },
  {
    title: "Your home",
    questions: [
      { name: "move_in", label: "Move-in date you want", type: "date", required: true },
      { name: "occupants", label: "How many people will live there in all?", type: "number", required: true },
      { name: "pets", label: "Pets", type: "textarea", hint: "Type, breed and weight of each, or 'None'. Assistance animals aren't pets: tell us separately and we'll handle it as an accommodation." },
      { name: "vehicles", label: "Vehicles", type: "textarea", hint: "Year, make, model and plate of each." },
    ],
  },
];

export const COMMERCIAL: Section[] = [
  contact,
  {
    title: "Your business",
    questions: [
      { name: "business_name", label: "Business legal name", type: "text", required: true },
      { name: "entity_type", label: "Type of business", type: "select", required: true, options: ["LLC", "Corporation", "Partnership", "Sole proprietor", "Nonprofit", "Other"] },
      { name: "years_in_business", label: "Years in business", type: "number" },
      { name: "use", label: "What will you use the space for?", type: "textarea", required: true },
      { name: "employees", label: "Employees at this location", type: "number" },
      { name: "monthly_income", label: "Business gross monthly revenue ($)", type: "money", required: true },
      { name: "move_in", label: "Move-in date you want", type: "date", required: true },
      { name: "current_address", label: "Current business address", type: "text" },
      { name: "landlord_name", label: "Current landlord", type: "text" },
      { name: "landlord_phone", label: "Their phone", type: "tel" },
    ],
  },
];

/** Co-applicants and guarantors only answer about themselves (no household questions). */
export function sectionsFor(kind: "residential" | "commercial", role: string): Section[] {
  if (kind === "commercial") return role === "applicant" ? COMMERCIAL : [contact, { title: "Income", questions: [RESIDENTIAL[2].questions[0], RESIDENTIAL[2].questions[3]] }];
  if (role === "applicant") return RESIDENTIAL;
  return [RESIDENTIAL[0], RESIDENTIAL[1], RESIDENTIAL[2]];
}

const toCents = (v: string) => Math.round(Number(v.replace(/[$,\s]/g, "")) * 100);

/** Reads and checks the answers. Returns an error message, or the answers and the monthly income. */
export function readAnswers(sections: Section[], form: FormData): { error: string } | { answers: Record<string, string>; incomeCents: number } {
  const answers: Record<string, string> = {};
  for (const q of sections.flatMap((s) => s.questions)) {
    const v = String(form.get(q.name) ?? "").trim().slice(0, q.type === "textarea" ? 1500 : 200);
    if (q.required && !v) return { error: `Please answer: ${q.label}.` };
    if (v && q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { error: "Enter a valid e-mail." };
    if (v && q.type === "money" && !(toCents(v) >= 0)) return { error: `${q.label}: enter a dollar amount.` };
    if (v && q.type === "number" && !(Number(v) >= 0)) return { error: `${q.label}: enter a number.` };
    if (v && q.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: `${q.label}: choose a date.` };
    if (v && q.type === "select" && !q.options?.includes(v)) return { error: `${q.label}: choose an option.` };
    answers[q.name] = v;
  }
  return { answers, incomeCents: answers.monthly_income ? toCents(answers.monthly_income) : 0 };
}

export const AUTHORIZATION =
  "I certify that what I've entered is true and complete. I authorize the landlord and its agent, and the screening company they use, to get consumer reports about me (credit, rental and eviction history, and criminal records) and to verify my income, employment and rental history, to decide on this application (Fair Credit Reporting Act, 15 U.S.C. 1681b). I understand the application fee pays for screening and processing.";
