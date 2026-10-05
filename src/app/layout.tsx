import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerMentor | Your job search, organized",
  description:
    "Organize role-specific resumes, discover entry-level jobs, and prepare applications for your review.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
