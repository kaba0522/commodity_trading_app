import { BrowseScreen } from "@/features/buyer/browse/screens/BrowseScreen";

/** Thin route — broker Browse reuses the buyer Browse screen (all seller listings). */
export default function BrokerBrowseRoute() {
  return <BrowseScreen browseBase="/broker/browse" />;
}
