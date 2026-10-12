"use client"

import { useTheme } from "@/lib/theme-context"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Toast surface: neutral card, status-tinted icon chip and hairline (see the
// [data-sonner-toast] rules in index.css). No height clamping — a toast with a
// title plus a description must never be clipped.
//
// `expand`: sonner's unexpanded stack collapses every toast behind the front
// one to `height: var(--front-toast-height)` and blanks its children with
// `[data-expanded='false'][data-front='false'] > * { opacity: 0 }`, revealing
// them only while the pointer is inside the toaster. Touch devices never fire
// that hover, and a stack of blank card edges tells the worker nothing, so the
// stack stays expanded: each queued toast shows its own text at its own
// natural height (sonner keys `--initial-height: auto` off this same prop).
//
// Geometry (the icon chip's box, the dismiss button) lives in index.css, not
// in these classNames: sonner ships its stylesheet unlayered, and unlayered CSS
// outranks `@layer utilities` no matter how specific the utility is — so
// `w-6 h-6`-style classes on those slots silently do nothing.
//
// Top centre: every toast in this app reports the outcome of a form the worker
// just submitted, and the submit buttons live in the middle of a wide card —
// a corner stack is the one place they are not looking.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      expand
      gap={8}
      offset={20}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border group-[.toaster]:border-border/70 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:gap-3 group-[.toaster]:items-start group-[.toaster]:backdrop-blur-sm",
          icon: "group-[.toast]:flex group-[.toast]:items-center group-[.toast]:shrink-0 group-[.toast]:rounded-md",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:leading-snug group-[.toast]:tracking-[-0.01em]",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground group-[.toast]:mt-0.5 group-[.toast]:leading-relaxed",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:h-8 group-[.toast]:px-3 group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:h-8 group-[.toast]:px-3 group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:font-medium",
        },
      }}
      closeButton
      {...props}
    />
  )
}

export { Toaster }
