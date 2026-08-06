import type { Metadata } from "next";
import MangaPageClient from "./MangaPageClient";

export const metadata: Metadata = {
  title: "Manga — Flyx",
  description: "Browse and read manga from WeebCentral. Free, no ads, no tracking.",
};

export default function MangaPage() {
  return <MangaPageClient />;
}
