import { ProfileScreen } from "@/features/shared/profile/screens/ProfileScreen";

/**
 * Thin route — the seller footer's Profile tab. Rendered inside the tabs
 * navigator, so the screen draws no back button and no second tab bar.
 */
export default function SellerProfileRoute() {
  return <ProfileScreen showBack={false} showTabBar={false} />;
}
