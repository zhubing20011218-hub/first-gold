// 纪念海报的小图和"保存纪念海报"（docs/10 第九节）。画布本身是 1080 × 1350，界面上缩小显示；保存时存成 PNG 图片，不发网络请求。
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { drawPoster, POSTER_H, POSTER_W, type PosterData } from "./posterDraw";

export interface PosterHandle {
  /** 存成图片：浏览器下载一个 PNG 文件 */
  save: (fileName: string) => void;
}

export const PosterCanvas = forwardRef<PosterHandle, { data: PosterData; label: string; className?: string }>(function PosterCanvas({ data, label, className }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let alive = true;
    // 等字体装好再画，不然数字会用备用字体
    void document.fonts.ready.then(() => {
      if (alive) drawPoster(ctx, data);
    });
    return () => {
      alive = false;
    };
  }, [data]);

  useImperativeHandle(ref, () => ({
    save: (fileName: string) => {
      const c = canvas.current;
      if (!c) return;
      c.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    },
  }));

  return <canvas ref={canvas} width={POSTER_W} height={POSTER_H} role="img" aria-label={label} className={className} />;
});
