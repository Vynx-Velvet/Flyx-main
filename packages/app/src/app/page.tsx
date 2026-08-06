import { getSession } from "@/lib/auth/get-session";
import LandingPage from "@/components/landing/LandingPage";
import HomePageContent from "@/components/HomePageContent";

export default async function HomePage() {
  const session = await getSession();
  const landingEnabled = process.env.ENABLE_LANDING_PAGE !== "false";

  // Show landing page to unauthenticated visitors when enabled
  if (landingEnabled && !session) {
    return <LandingPage />;
  }

  // Authenticated user or landing disabled → show content home
  return <HomePageContent />;
}
