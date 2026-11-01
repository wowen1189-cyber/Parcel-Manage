import type { Metadata } from "next";
import { Archivo, Caveat } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Only for the handwritten signature line on letters.
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["600"] });

export const metadata: Metadata = {
  title: { default: "Parcel Manage", template: "%s · Parcel Manage" },
  description: "Property management software",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
