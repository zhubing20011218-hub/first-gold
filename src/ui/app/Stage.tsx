// 唯一的画面骨架（docs/12 第三节）：世界一直在最下面一层，上面盖当前阶段的内容和最多一个弹窗。
import { useCallback, useState } from "react";
import { WorldCanvas } from "../../scene/WorldCanvas";
import type { LabelAnchors } from "../../scene/world/World";
import { useStore } from "../store/store";
import { canvasLabelOf, inquiriesOf, playProgressOf, productOf, statusOf, timelineOf, worldLabelsOf, worldViewOf } from "../store/selectors";
import { Timeline, StatusBar, InquiryNote } from "../components/biz/TopBar";
import { WorldLabels } from "../components/biz/WorldLabels";
import { HomeLayer } from "../stages/HomeLayer";
import { SetupLayer } from "../stages/SetupLayer";
import { DecideLayer } from "../stages/DecideLayer";
import { PlayLayer } from "../stages/PlayLayer";
import { SettleLayer } from "../stages/SettleLayer";
import { EndingLayer } from "../stages/EndingLayer";
import { BillPopup } from "../popups/BillPopup";
import { DeskPopup } from "../popups/DeskPopup";
import { BulkShortPopup } from "../popups/BulkShortPopup";
import { DebugPanel } from "../dev/DebugPanel";
import { StockPopup } from "../popups/StockPopup";
import { RetailPopup } from "../popups/RetailPopup";
import { BulkPopup } from "../popups/BulkPopup";
import { RiskPopup } from "../popups/RiskPopup";
import { PushPopup } from "../popups/PushPopup";
import { SourcePopup } from "../popups/SourcePopup";
import { formatYuan } from "../store/selectors";
import { zh } from "../../text/zh";

/** 前排和底部一共占的高度（docs/08 第二节，规则包第 13 版）：204 + 18 + 70 + 16 */
const BOTTOM_UI = 308;
/** 手机布局和电脑布局的分界（docs/08 第一节，规则包第 14 版） */
const DESK = 1024;

/** 世界要放进的区域：电脑上在 70 到前排顶边之间；手机上占屏幕上面的三分之一 */
function fitFor(w: number, h: number) {
  if (w < DESK) return { left: 8, top: 96, width: w - 16, height: Math.round(h / 3) - 96 };
  return { left: 24, top: 70, width: w - 48, height: Math.max(160, h - BOTTOM_UI - 70 - 8) };
}

export function Stage() {
  const ui = useStore();
  const [anchors, setAnchors] = useState<LabelAnchors | null>(null);
  const onAnchors = useCallback((a: LabelAnchors) => setAnchors(a), []);
  const view = worldViewOf(ui);
  const status = statusOf(ui);
  const t = timelineOf(ui);
  const product = productOf(ui);
  const label = canvasLabelOf(ui);
  const inGame = ui.stage === "decide" || ui.stage === "play" || ui.stage === "settle" || ui.stage === "ending";
  const canvasText = zh.world.canvas(zh.timeline.quarter[t.quarter % 4], String(label.stock), String(label.goods), formatYuan(label.moneyFen));
  const progress = playProgressOf(ui);
  const debug = typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");
  const floorY = typeof window === "undefined" ? 492 : window.innerWidth < DESK ? Math.round(window.innerHeight / 3) : window.innerHeight - BOTTOM_UI;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <WorldCanvas view={view} fitFor={fitFor} onAnchors={onAnchors} label={canvasText} />
      {ui.stage !== "home" && <WorldLabels anchors={anchors} data={inGame ? worldLabelsOf(ui) : null} floorY={floorY} />}
      {inGame && status && (
        <>
          <div className="absolute top-4 left-6 z-10 max-md:left-2">
            <Timeline quarter={t.quarter} year={t.year} season={t.season} />
          </div>
          <div className="absolute top-4 right-6 z-10 flex flex-col items-end gap-4 max-md:top-under-bar max-md:right-2">
            <StatusBar s={status} onPush={() => ui.openPopup("push")} onSource={() => ui.openPopup("source")} />
            {ui.stage === "decide" && product && (
              <InquiryNote items={inquiriesOf(ui)} refPriceSen={product.bulkRefPriceSen} onOpen={() => ui.openPopup("bulk")} firstTime={t.quarter === 1} />
            )}
            {/* 播放时右上的询价换成"第 37 天 / 90"（docs/07 第四节） */}
            {ui.stage === "play" && progress && (
              <div data-region="inquiry" className="rounded-full border-2 border-ink bg-paper px-4 py-2 text-em font-bold">
                {zh.play.day(String(progress.day), String(progress.total))}
              </div>
            )}
          </div>
        </>
      )}
      {ui.stage === "home" && <HomeLayer />}
      {ui.stage === "setup" && <SetupLayer />}
      {ui.stage === "decide" && <DecideLayer />}
      {ui.stage === "play" && <PlayLayer />}
      {ui.stage === "settle" && <SettleLayer />}
      {ui.stage === "ending" && <EndingLayer />}
      {ui.popup === "stock" && <StockPopup />}
      {ui.popup === "retail" && <RetailPopup />}
      {ui.popup === "bulk" && <BulkPopup />}
      {ui.popup === "risk" && <RiskPopup />}
      {ui.popup === "push" && <PushPopup />}
      {ui.popup === "source" && <SourcePopup />}
      {ui.popup === "bill" && <BillPopup />}
      {ui.popup === "desk" && <DeskPopup />}
      {ui.popup === "bulkShort" && <BulkShortPopup />}
      {debug && <DebugPanel />}
    </div>
  );
}
