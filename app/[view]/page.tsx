import { notFound } from "next/navigation";
import { CareApp } from "@/components/care-app";
import type { View } from "@/lib/types";

const views = [
  "medicines",
  "symptoms",
  "history",
  "reports",
  "settings",
] as const;
export function generateStaticParams() {
  return views.map((view) => ({ view }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  return { title: view.charAt(0).toUpperCase() + view.slice(1) };
}
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!views.includes(view as (typeof views)[number])) notFound();
  return <CareApp view={view as View} />;
}
