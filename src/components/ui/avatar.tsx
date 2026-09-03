"use client";
import { Avatar as HeroAvatar } from "@heroui/react";
import { cn } from "@/lib/utils";
export function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof HeroAvatar>) {
  return (
    <HeroAvatar
      size="md"
      variant="soft"
      color="accent"
      className={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  );
}
export function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof HeroAvatar.Image>) {
  return (
    <HeroAvatar.Image
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}
export function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof HeroAvatar.Fallback>) {
  return (
    <HeroAvatar.Fallback
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary",
        className,
      )}
      {...props}
    />
  );
}
