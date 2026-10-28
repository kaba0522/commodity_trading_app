import { useLocalSearchParams } from "expo-router";
import { PostRequirementScreen } from "@/features/buyer/requirements/screens/PostRequirementScreen";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Thin route — parses the selected BUY requirement into the shared form. */
export default function EditRequirementRoute() {
  const params = useLocalSearchParams<{
    id: string;
    categoryId?: string;
    commodityId?: string;
    quantity?: string;
  }>();
  const id = firstParam(params.id);

  return (
    <PostRequirementScreen
      editId={id}
      initialValues={{
        categoryId: firstParam(params.categoryId) ?? "",
        commodityId: firstParam(params.commodityId) ?? "",
        quantity: firstParam(params.quantity) ?? "",
      }}
    />
  );
}
