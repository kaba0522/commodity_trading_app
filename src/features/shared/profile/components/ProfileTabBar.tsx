import { router } from "expo-router";
import { AppTabBar, BROKER_BAR, BUYER_BAR, SELLER_BAR } from "@/components/common/AppTabBar";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Role } from "@/types/domain";

/** Tab targets double as URL segments — `replace` avoids stacking tabs over profile screens. */
function goTab(target: string, role: Role | null) {
  const isBroker = role === "broker";
  switch (target) {
    case "browse":
      return router.replace(isBroker ? "/broker/browse" : "/browse");
    case "trades":
      return router.replace(isBroker ? "/broker/trades" : "/trades");
    case "post-req":
      return router.replace("/post-req");
    case "freight":
      return router.replace("/freight");
    case "profile":
      return router.replace("/profile");
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
  let barItems;
  let active;
  switch (role) {
    case "seller":
      barItems = SELLER_BAR;
      active = "seller-profile";
      break;
    case "broker":
      barItems = BROKER_BAR;
      active = "profile";
      break;
    case "buyer":
    default:
      barItems = BUYER_BAR;
      active = "profile";
      break;
  }
  if (!barItems) return null;
  return (
    <AppTabBar
      items={barItems}
      active={active}
      onPress={(target) => goTab(target, role)}
    />
  );
}
