"use client"

import { useTheme } from "@/lib/theme-context"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Toast surface: neutral card, status-tinted icon chip and hairline (see the
// [data-sonner-toast] rules in index.css). No height clamping — a toast with a
// title plus a description must never be clipped, and touch devices have no
// hover to expand it. The close button stays visible for the same reason.
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
      expand={false}
      gap={8}
      offset={20}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border group-[.toaster]:border-border/70 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:gap-3 group-[.toaster]:items-start group-[.toaster]:backdrop-blur-sm",
          icon: "group-[.toast]:mt-0.5 group-[.toast]:flex group-[.toast]:items-center group-[.toast]:justify-center group-[.toast]:w-6 group-[.toast]:h-6 group-[.toast]:rounded-md group-[.toast]:shrink-0",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:leading-snug group-[.toast]:tracking-[-0.01em]",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground group-[.toast]:mt-0.5 group-[.toast]:leading-relaxed",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:h-8 group-[.toast]:px-3 group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:h-8 group-[.toast]:px-3 group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:font-medium",
          closeButton:
            "group-[.toast]:absolute group-[.toast]:top-3 group-[.toast]:right-3 group-[.toast]:bg-transparent group-[.toast]:border-0 group-[.toast]:w-5 group-[.toast]:h-5 group-[.toast]:p-0 group-[.toast]:text-muted-foreground/60 group-[.toast]:transition-opacity group-[.toast]:shadow-none group-[.toast]:rounded hover:group-[.toast]:text-foreground group-[.toast]:opacity-100 md:group-[.toast]:opacity-0 md:hover:group-[.toast]:opacity-100 md:focus:group-[.toast]:opacity-100",
        },
      }}
      closeButton
      {...props}
    />
  )
}

export { Toaster }
