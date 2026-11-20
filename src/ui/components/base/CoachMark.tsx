// 新手提示（docs/07 第 6.6 节）：指向一个地方，点一下就消失。用 Radix 的 Popover 做。
// 手机上左右放不下，一律放在上面或下面，并且离屏幕边缘至少 16（不被切掉）
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useState, type ReactNode } from "react";
import { zh } from "../../../text/zh";

export interface CoachMarkProps {
  open: boolean;
  text: string;
  step: number;
  total: number;
  onNext: () => void;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

function useNarrow(): boolean {
  const query = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = (): void => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function CoachMark({ open, text, step, total, onNext, children, side = "bottom" }: CoachMarkProps) {
  const narrow = useNarrow();
  const placed = narrow && (side === "left" || side === "right") ? "bottom" : side;
  return (
    <Popover.Root open={open}>
      <Popover.Anchor asChild>{children}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side={placed}
          sideOffset={8}
          collisionPadding={16}
          onPointerDownOutside={onNext}
          onEscapeKeyDown={onNext}
          className="z-40 flex max-w-80 flex-col gap-2 rounded-control border-2 border-ink bg-gold-soft px-4 py-3 text-body shadow-solid-sm"
        >
          <span>{text}</span>
          <button type="button" onClick={onNext} className="inline-flex min-h-hit-desk min-w-hit-desk items-center justify-center self-end px-2 text-cap font-bold text-gold-text max-md:min-h-hit max-md:min-w-hit">
            {zh.coach.next(step, total)}
          </button>
          <Popover.Arrow className="fill-ink" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
