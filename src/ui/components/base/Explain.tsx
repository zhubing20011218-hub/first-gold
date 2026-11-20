// 点一个数字，旁边弹出一句解释（docs/12 第 6.5 节），用 Radix 的 Popover 做
import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

export function Explain({ children, text }: { children: ReactNode; text: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger className="cursor-help underline decoration-muted decoration-dashed underline-offset-4 max-md:inline-flex max-md:min-h-hit max-md:min-w-hit max-md:items-center max-md:justify-center">{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} className="z-40 max-w-80 rounded-control border-2 border-ink bg-paper px-3 py-2 text-body shadow-solid-sm">
          {text}
          <Popover.Arrow className="fill-ink" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
