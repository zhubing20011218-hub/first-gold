// 新手提示（docs/07 第 6.6 节）：指向一个地方，点一下就消失。用 Radix 的 Popover 做
import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";
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

export function CoachMark({ open, text, step, total, onNext, children, side = "bottom" }: CoachMarkProps) {
  return (
    <Popover.Root open={open}>
      <Popover.Anchor asChild>{children}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={8}
          onPointerDownOutside={onNext}
          onEscapeKeyDown={onNext}
          className="z-40 flex max-w-80 flex-col gap-2 rounded-control border-2 border-ink bg-gold-soft px-4 py-3 text-body shadow-solid-sm"
        >
          <span>{text}</span>
          <button type="button" onClick={onNext} className="self-end text-cap font-bold text-gold-text max-md:min-h-hit max-md:min-w-hit">
            {zh.coach.next(step, total)}
          </button>
          <Popover.Arrow className="fill-ink" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
