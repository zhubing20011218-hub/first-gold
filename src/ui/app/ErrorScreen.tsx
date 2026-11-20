// 代码出错时的一屏（docs/09 第 214 行、docs/12 第二节）："出错了。刷新页面可以重新开始。"下面用小字显示种子编号。
import { Component, type ErrorInfo, type ReactNode } from "react";
import { zh } from "../../text/zh";

interface Props {
  children: ReactNode;
  /** 现在这一局的种子；还没开局时没有 */
  seed?: () => number | null;
}

export class ErrorScreen extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 开发时在控制台能看到出错的地方；截图脚本会把控制台报错算成 S5 不通过
    console.error(error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-sea-soft px-6 text-center" role="alert">
        <p className="text-title font-bold">{zh.ui.error}</p>
        {seedLine(this.props.seed)}
      </div>
    );
  }
}

function seedLine(seed: Props["seed"]): ReactNode {
  const v = seed?.() ?? null;
  return v === null ? null : <p className="text-cap text-muted">{zh.ui.errorSeed(String(v))}</p>;
}
