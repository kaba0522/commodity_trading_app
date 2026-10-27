import { colors } from "@/theme/colors";
import Svg, { Path } from "react-native-svg";

interface ChevronIconProps {
  direction?: "right" | "down";
  color?: string;
  size?: number;
}

export function ChevronIcon({
  direction = "right",
  color = colors.muted,
  size = 18,
}: ChevronIconProps) {
  const path =
    direction === "down" ? "M6 9l6 6 6-6" : "M9 18l6-6-6-6";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={path}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
