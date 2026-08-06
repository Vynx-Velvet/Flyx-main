import SettingsPageClient from "./SettingsPageClient";

export const metadata = {
  title: "Settings",
  description: "Customize providers, playback, sync, and subtitles",
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
