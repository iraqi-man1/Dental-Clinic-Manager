import * as React from "react";
import { Card as HeroCard } from "@heroui/react";
import { cn } from "@/lib/utils";

export function Card({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <HeroCard
      className={cn(
        "rounded-2xl border-border bg-card text-card-foreground shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </HeroCard>
  );
}
export function CardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <HeroCard.Header className={cn("flex flex-col gap-1.5 p-5 sm:p-6", className)} {...props} />
  );
}
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <HeroCard.Title
      className={cn("text-base font-bold tracking-[-0.018em]", className)}
      {...props}
    />
  );
}
export function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <HeroCard.Description className={cn("text-sm leading-5 text-muted-foreground", className)} {...props} />
  );
}
export function CardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <HeroCard.Content className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}
