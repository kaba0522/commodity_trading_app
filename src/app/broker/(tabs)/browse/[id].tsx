import { ListingDetailScreen } from "@/features/buyer/browse/screens/ListingDetailScreen";

/** Thin route — broker listing detail, opened from the broker Browse stack. */
export default function BrokerListingDetailRoute() {
  return <ListingDetailScreen browseBase="/broker/browse" readOnly />;
}
