"use client"

import { useTheme } from "@/lib/theme-context"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Toast surface: neutral card, status-tinted accent and icon (see the
// [data-sonner-toast] rules in index.css). No height clamping — a toast with a
// title plus a description must never be clipped, and touch devices have no
// hover to expand it. The close button stays visible for the same reason.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand={false}
      gap={10}
      offset={16}
      visibleToasts={4}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:transition-all group-[.toaster]:duration-200 group-[.toaster]:ease-out group-[.toaster]:items-start",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:leading-snug",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground group-[.toast]:mt-1 group-[.toast]:leading-relaxed",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:h-8 group-[.toast]:px-3 group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:h-8 group-[.toast]:px-3 group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:font-medium",
          closeButton:
            "group-[.toast]:absolute group-[.toast]:top-2.5 group-[.toast]:right-2.5 group-[.toast]:bg-transparent group-[.toast]:border-0 group-[.toast]:w-5 group-[.toast]:h-5 group-[.toast]:p-0 group-[.toast]:text-muted-foreground group-[.toast]:transition-colors group-[.toast]:shadow-none hover:group-[.toast]:text-foreground",
        },
      }}
      closeButton
      {...props}
    />
  )
}

export { Toaster }
