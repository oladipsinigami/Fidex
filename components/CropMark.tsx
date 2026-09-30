interface CropMarkProps {
  corner: "tl" | "tr" | "bl" | "br";
  size?: number;
  className?: string;
}

export function CropMark({
  corner,
  size = 18,
  className = "",
}: CropMarkProps) {
  const borderClasses = {
    tl: "top-0 left-0 border-t-2 border-l-2",
    tr: "top-0 right-0 border-t-2 border-r-2",
    bl: "bottom-0 left-0 border-b-2 border-l-2",
    br: "bottom-0 right-0 border-b-2 border-r-2",
  }[corner];

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute border-current opacity-70 ${borderClasses} ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
