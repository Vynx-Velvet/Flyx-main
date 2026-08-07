import { getSession } from "@/lib/auth/get-session";
import { redirect } from "next/navigation";
import HomePageContent from "@/components/HomePageContent";

export default async function HomePage() {
  const session = await getSession();

  // Unauthenticated visitors → sign-in page
  if (!session) {
    redirect("/login");
  }

  // Authenticated user → content home
  return <HomePageContent />;
}
