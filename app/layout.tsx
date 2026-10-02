import type { Metadata, Viewport } from "next";
import { CareProvider } from "@/components/care-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KiddyMeds · A little care, all in one place",
    template: "%s · KiddyMeds",
  },
  description:
    "A calmer way to keep track of your little one's medicines, symptoms, and daily care. Private, local, and available offline.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "KiddyMeds" },
  icons: { icon: "/favicon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#f4f5f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CareProvider>{children}</CareProvider>
      </body>
    </html>
  );
}
