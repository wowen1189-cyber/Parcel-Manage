import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// Plain, accessible tables for list screens. Wide tables scroll sideways on phones.
export function Table({ minWidth = 760, children }: { minWidth?: number; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface-muted text-[13px] text-muted">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({ right, className, ...props }: ComponentProps<"th"> & { right?: boolean }) {
  return <th scope="col" className={cx("px-5 py-3 font-semibold", right && "text-right", className)} {...props} />;
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function Td({ right, className, ...props }: ComponentProps<"td"> & { right?: boolean }) {
  return <td className={cx("px-5 py-3 align-top", right && "tabular text-right", className)} {...props} />;
}

/** The main link in a row (property name, tenant name). */
export function RowLink({ href, children, sub }: { href: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <Link href={href} className="font-semibold text-ink hover:text-accent hover:underline">
        {children}
      </Link>
      {sub && <p className="text-[13px] text-subtle">{sub}</p>}
    </>
  );
}
