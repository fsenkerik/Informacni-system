import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Malá sada prvků postavená na design tokenech z globals.css.
 * Záměrně bez knihovny komponent – celé UI je tak čitelné na jednom místě
 * a učitel si ho může snadno přebarvit.
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover shadow-sm disabled:bg-border-strong",
  secondary:
    "bg-surface text-ink border border-border hover:border-border-strong hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-3",
  danger: "bg-bad text-white hover:brightness-110",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-60",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(23,26,38,0.05)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink",
        "placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/30",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink",
        "focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/30",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  children,
  hint,
  htmlFor,
}: {
  children: ReactNode;
  hint?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-2">
      {children}
      {hint ? <span className="ml-2 font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

type Tone = "neutral" | "ok" | "warn" | "bad" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  accent: "bg-accent-soft text-accent",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-border-strong bg-surface-2 px-6 py-10 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad"
    >
      {children}
    </p>
  );
}

/** Kód projektu – velký, jednoznačný, aby ho třída přečetla z tabule. */
export function JoinCode({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-lg font-semibold tracking-[0.25em] text-ink",
        className,
      )}
    >
      {code}
    </span>
  );
}
