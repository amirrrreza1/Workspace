import type { ImgHTMLAttributes } from "react";

export interface WorkspaceIconProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  size?: number | string;
  variant?: "mark" | "tile";
}

export function WorkspaceIcon({
  size = 24,
  variant: _variant = "mark",
  className,
  alt = "Workspace",
  style,
  ...props
}: WorkspaceIconProps) {
  const dimension = typeof size === "number" ? `${size}px` : size;

  return (
    <img
      src="/icons/workspace-layers-trio-512.png"
      alt={alt}
      width={typeof size === "number" ? size : undefined}
      height={typeof size === "number" ? size : undefined}
      className={className}
      style={{
        width: dimension,
        height: dimension,
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
        userSelect: "none",
        ...style,
      }}
      {...props}
    />
  );
}
