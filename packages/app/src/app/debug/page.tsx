import type { Metadata } from "next";
import DebugPageClient from "./DebugPageClient";

export const metadata: Metadata = {
  title: "Debug Logs",
  description: "View application logs and error details for troubleshooting.",
};

export default function DebugPage() {
  return <DebugPageClient />;
}
