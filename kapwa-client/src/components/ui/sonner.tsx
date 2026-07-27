"use client"

import { useTheme } from "@/lib/theme-context"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      expand={false}
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:transition-all group-[.toaster]:duration-200 group-[.toaster]:ease-out group-[.toaster]:overflow-hidden group-[.toaster]:max-h-[52px] group-hover:[&]:max-h-[300px]",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:leading-snug",
          description: "group-[.toast]:text-sm group-[.toast]:text-muted-foreground group-[.toast]:mt-1 group-[.toast]:leading-relaxed",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:h-8 group-[.toast]:px-3 group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:h-8 group-[.toast]:px-3 group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:font-medium",
          closeButton:
            "group-[.toast]:absolute group-[.toast]:top-3 group-[.toast]:right-3 group-[.toast]:bg-transparent group-[.toast]:border-0 group-[.toast]:w-4 group-[.toast]:h-4 group-[.toast]:p-0 group-[.toast]:text-muted-foreground/40 hover:group-[.toast]:text-foreground group-[.toast]:transition-colors group-[.toast]:shadow-none group-[.toast]:opacity-0 group-hover:[&]:opacity-100",
        },
      }}
      closeButton
      {...props}
    />
  )
}

export { Toaster }
