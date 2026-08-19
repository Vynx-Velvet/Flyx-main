import DownloadsClient from "@/components/downloads/DownloadsClient";

export const metadata = {
  title: "Downloads",
  description: "Manage downloads to this device",
};

export default function DownloadsPage() {
  return <DownloadsClient />;
}
