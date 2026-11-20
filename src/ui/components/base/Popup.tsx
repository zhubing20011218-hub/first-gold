// 弹窗的外框（docs/09 第四节），用 Radix 的 Dialog 做：焦点、Esc、遮罩。
// 四种位置：正中偏下（mid，前排的正上方）、顶部右边（top-right）、右边滑出（side）、正中（center）。手机上都从底部升起。
// 关闭后焦点回到打开它的那个按钮（docs/09 第四节第 3 条）：打开时记下当时有焦点的元素，关闭时还给它。
import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import { zh } from "../../../text/zh";

export type PopupPlace = "mid" | "top-right" | "side" | "center";
export type PopupWidth = "popup" | "popup-push" | "popup-bill" | "popup-source" | "popup-short";

export interface PopupProps {
  open: boolean;
  title: string;
  description?: string;
  place: PopupPlace;
  width: PopupWidth;
  /** P9 不能直接关掉 */
  dismissible?: boolean;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
}

const widthClass: Record<PopupWidth, string> = {
  popup: "md:w-popup",
  "popup-push": "md:w-popup-push",
  "popup-bill": "md:w-popup-bill",
  "popup-source": "md:w-popup-source",
  "popup-short": "md:w-popup-short",
};

export function Popup({ open, title, description, place, width, dismissible = true, onClose, footer, children, testId }: PopupProps) {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  // open 刚变成 true 的这一次渲染，弹窗还没拿走焦点：记下打开它的元素
  if (open && !wasOpen.current && typeof document !== "undefined") {
    const el = document.activeElement;
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
  }
  useEffect(() => {
    wasOpen.current = open;
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && dismissible && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay data-scrim className="fixed inset-0 z-20 bg-scrim/40" />
        <Dialog.Content
          data-popup={testId}
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          onCloseAutoFocus={(e) => {
            const back = opener.current;
            opener.current = null;
            if (back && back.isConnected) {
              e.preventDefault();
              back.focus();
            }
          }}
          className={clsx(
            "fixed z-30 flex flex-col border-2 border-ink bg-paper shadow-dialog outline-none",
            "max-md:inset-x-0 max-md:bottom-0 max-md:max-h-sheet max-md:rounded-t-dialog",
            place === "mid" ? "md:max-h-popup-mid-max md:rounded-dialog" : "md:max-h-popup-max md:rounded-dialog",
            widthClass[width],
            place === "mid" && "md:bottom-popup-mid md:left-1/2 md:-translate-x-1/2",
            place === "center" && "md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
            place === "top-right" && "md:top-popup-top md:right-6",
            place === "side" && "md:top-4 md:right-4 md:bottom-4",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b-2 border-line px-6 pt-4 pb-3">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-title font-bold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-body text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            {dismissible && (
              <Dialog.Close aria-label={zh.ui.close} className="flex h-hit-desk w-hit-desk shrink-0 items-center justify-center rounded-full border-2 border-ink text-em font-bold hover:bg-sea-soft max-md:h-hit max-md:w-hit">
                {zh.ui.closeSign}
              </Dialog.Close>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-3 border-t-2 border-line px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
