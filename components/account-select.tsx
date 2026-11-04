import type { AccountOption } from "@/lib/accounts";
import { Select } from "@/components/ui";

// An account dropdown grouped under its headings (Repairs and maintenance, Utilities, …).
export function AccountSelect({ accounts, name = "expense_account", defaultValue }: { accounts: AccountOption[]; name?: string; defaultValue?: string }) {
  const groups = new Map<string, AccountOption[]>();
  for (const a of accounts) groups.set(a.section, [...(groups.get(a.section) ?? []), a]);
  return (
    <Select name={name} defaultValue={defaultValue}>
      {[...groups].map(([section, list]) => (
        <optgroup key={section} label={section}>
          {list.map((a) => (
            <option key={a.number} value={a.number}>
              {a.number} {a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
