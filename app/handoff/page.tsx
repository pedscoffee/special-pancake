import type { Metadata } from "next";
import { HandoffView } from "@/components/handoff-view";

const site = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://special-pancake-iota.vercel.app"),
);

// The same preview for every hand-off link. Care details live after the "#",
// which link-preview services never receive.
export const metadata: Metadata = {
  metadataBase: site,
  title: { absolute: "A care update from KiddyMeds" },
  description:
    "Tap to see the latest medicines and symptoms. No app or account needed.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "A care update from KiddyMeds",
    description:
      "Tap to see the latest medicines and symptoms. No app or account needed.",
    siteName: "KiddyMeds",
    type: "website",
    url: "/handoff/",
    images: [
      {
        url: "/og-handoff.png",
        width: 1200,
        height: 630,
        alt: "KiddyMeds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "A care update from KiddyMeds",
    description:
      "Tap to see the latest medicines and symptoms. No app or account needed.",
    images: ["/og-handoff.png"],
  },
};

export default function HandoffPage() {
  return <HandoffView />;
}
