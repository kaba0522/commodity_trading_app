import { router } from "expo-router";
import { AppTabBar, BUYER_BAR, SELLER_BAR } from "@/components/common/AppTabBar";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { useAuth } from "@/features/auth/hooks/useAuth";

/** Tab targets double as URL segments — `replace` avoids stacking tabs over profile screens. */
function goTab(target: string) {
  switch (target) {
    case "browse":
      return router.replace("/browse");
    case "trades":
      return router.replace("/trades");
    case "post-req":
      return router.replace("/post-req");
    case "freight":
      return router.replace("/freight");
    case "requirements":
      return router.replace("/requirements");
    case "orders":
      return router.replace("/orders");
    case "add-listing":
      return router.replace("/add-listing");
    case "transport":
      return router.replace("/transport");
    case "seller-profile":
      return router.replace("/seller-profile");
    default:
      return router.back();
  }
}

/**
 * Role bottom bar for screens in the root-level `(shared)` stack (outside
 * the tab navigators), so the bar stays visible on profile/account screens.
 */
export function ProfileTabBar() {
  const { session } = useAuth();
  const role = resolveBackendRole(session?.user);
  const barItems = role === "seller" ? SELLER_BAR : role === "buyer" ? BUYER_BAR : null;
  if (!barItems) return null;
  return (
    <AppTabBar
      items={barItems}
      active={role === "seller" ? "seller-profile" : null}
      onPress={goTab}
    />
  );
}
