import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  /** Required: it is the accessible name and the desktop tooltip. */
  label: string;
  icon?: ReactNode;
  children?: ReactNode;
  variant?: "ghost" | "filled" | "secondary";
  size?: "md" | "sm";
  tooltipSide?: "bottom" | "top" | "left" | "right";
  /** Hide the tooltip where the label is already visible nearby. */
  noTooltip?: boolean;
};

/** docs/design/TANGENT-STYLE.md §8 IconButton: a 44px round hit area. */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, children, variant = "ghost", size = "md", tooltipSide = "bottom", noTooltip = false, className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-label={label}
      data-tooltip={noTooltip ? undefined : label}
      data-tooltip-side={noTooltip || tooltipSide === "bottom" ? undefined : tooltipSide}
      className={`ui-icon-button ui-icon-button--${variant} ui-icon-button--${size} ${className}`.trim()}
    >
      {icon ?? children}
    </button>
  );
});

export default IconButton;
