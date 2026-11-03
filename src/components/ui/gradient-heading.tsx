import React from "react";

export interface GradientHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  variant?: "default" | "secondary" | "brand";
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "p";
}

const sizeClasses: Record<NonNullable<GradientHeadingProps["size"]>, string> = {
  sm: "text-lg font-semibold md:text-xl",
  md: "text-2xl font-bold md:text-3xl tracking-tight",
  lg: "text-3xl font-extrabold md:text-4xl tracking-tight",
  xl: "text-4xl font-extrabold md:text-5xl tracking-tight",
  xxl: "text-4xl font-black md:text-6xl tracking-tight",
};

const variantClasses: Record<NonNullable<GradientHeadingProps["variant"]>, string> = {
  default: "bg-gradient-to-r from-ink via-ink/90 to-ink/65 bg-clip-text text-transparent",
  secondary: "text-muted font-medium uppercase tracking-[0.2em] text-xs sm:text-sm",
  brand: "bg-gradient-to-r from-brand via-brand-dark to-accent bg-clip-text text-transparent",
};

export function GradientHeading({
  children,
  className = "",
  variant = "default",
  size = "md",
  as: Component = "h2",
  ...props
}: GradientHeadingProps) {
  const sizeClass = variant === "secondary" ? "" : sizeClasses[size] || sizeClasses.md;
  const variantClass = variantClasses[variant] || variantClasses.default;

  return (
    <Component
      className={`${sizeClass} ${variantClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
}
