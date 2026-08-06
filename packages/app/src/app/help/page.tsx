import type { Metadata } from "next";
import HelpPageClient from "./HelpPageClient";

export const metadata: Metadata = {
  title: "Help & Guides",
  description:
    "Learn how to use Flyx — setup, streaming to your TV, player controls, and troubleshooting.",
};

export default function HelpPage() {
  return <HelpPageClient />;
}
