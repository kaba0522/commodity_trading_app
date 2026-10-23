import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";

interface IconProps {
  size?: number;
  color: string;
}

function Base({ size = 22, color, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/** Ported from the prototype bottom nav (Feather-style 22px stroke icons). */
export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Base>
  );
}

export function BrowseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx={11} cy={11} r={7} />
      <Line x1={21} y1={21} x2={16.5} y2={16.5} />
    </Base>
  );
}

export function TradesIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Polyline points="17 2 21 6 17 10" />
      <Line x1={21} y1={6} x2={5} y2={6} />
      <Polyline points="7 22 3 18 7 14" />
      <Line x1={3} y1={18} x2={19} y2={18} />
    </Base>
  );
}

export function PostReqIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Rect x={3} y={3} width={18} height={18} rx={4} />
      <Line x1={12} y1={8} x2={12} y2={16} />
      <Line x1={8} y1={12} x2={16} y2={12} />
    </Base>
  );
}

export function FreightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Rect x={1} y={6} width={14} height={11} rx={1} />
      <Path d="M15 9h4l4 4v4h-8z" />
      <Circle cx={6} cy={18} r={2} />
      <Circle cx={18} cy={18} r={2} />
    </Base>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Base>
  );
}
