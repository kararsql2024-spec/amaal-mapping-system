import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      dir="rtl"
      position="bottom-left"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-md group-[.toaster]:border group-[.toaster]:border-line group-[.toaster]:bg-card group-[.toaster]:text-fg group-[.toaster]:text-[13px] group-[.toaster]:shadow-xl",
          description: "group-[.toast]:text-fg-muted group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:rounded-sm group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:rounded-sm group-[.toast]:bg-secondary group-[.toast]:text-fg-secondary",
          success: "group-[.toaster]:[&_[data-icon]]:text-status-available",
          error: "group-[.toaster]:[&_[data-icon]]:text-status-sold",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
