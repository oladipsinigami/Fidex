import type { SVGProps } from "react";

export function Barcode({
  className = "h-10 w-16",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 72 40"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect x="0" y="0" width="3" height="40" />
      <rect x="5" y="0" width="1.5" height="40" />
      <rect x="9" y="0" width="4" height="40" />
      <rect x="15" y="0" width="1.5" height="40" />
      <rect x="19" y="0" width="3" height="40" />
      <rect x="24" y="0" width="1" height="40" />
      <rect x="27" y="0" width="4" height="40" />
      <rect x="33" y="0" width="2" height="40" />
      <rect x="37" y="0" width="1.5" height="40" />
      <rect x="41" y="0" width="3.5" height="40" />
      <rect x="47" y="0" width="1" height="40" />
      <rect x="50" y="0" width="4" height="40" />
      <rect x="56" y="0" width="2" height="40" />
      <rect x="60" y="0" width="1.5" height="40" />
      <rect x="64" y="0" width="3" height="40" />
      <rect x="69" y="0" width="2" height="40" />
    </svg>
  );
}
