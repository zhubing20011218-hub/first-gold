// 展示页 ?gallery=1（docs/09 第九节）：每个基础组件的每种变体和状态；三个功能区的三种状态；印章。世界和每一样模型在任务 06 第二步加上。
// 这里的示例数字只用来看样子，不是游戏里的数字。
import { useState, type ReactNode } from "react";
import { Bar } from "../components/base/Bar";
import { Button } from "../components/base/Button";
import { CoachMark } from "../components/base/CoachMark";
import { Explain } from "../components/base/Explain";
import { MoneyText } from "../components/base/MoneyText";
import { NumberText } from "../components/base/NumberText";
import { Pill } from "../components/base/Pill";
import { Popup } from "../components/base/Popup";
import { Segmented } from "../components/base/Segmented";
import { Stamp } from "../components/base/Stamp";
import { Stepper } from "../components/base/Stepper";
import { Tag } from "../components/base/Tag";
import { AreaPanel } from "../components/biz/AreaPanel";
import { AreaIcon } from "../components/biz/AreaIcon";
import { zh } from "../../text/zh";
import { gallerySamples as S } from "./gallerySamples";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-dialog border-2 border-ink bg-paper p-6">
      <h2 className="text-title font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="w-24 shrink-0 text-cap text-muted">{label}</span>
      {children}
    </div>
  );
}

export function Gallery() {
  const g = zh.gallery;
  const [popup, setPopup] = useState(false);
  const [coach, setCoach] = useState(true);
  const [seg, setSeg] = useState<"no" | "yes">("yes");
  const [qty, setQty] = useState(S.stepperQty);
  const [stampKey, setStampKey] = useState(0);

  return (
    <div className="h-full overflow-y-auto bg-sea-soft">
      <main className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8" data-gallery>
        <h1 className="text-screen font-bold">{g.title}</h1>

        <Section title={g.base}>
          <Row label="Button">
            <Button variant="primary">{g.variants.primary}</Button>
            <Button variant="confirm">{g.variants.confirm}</Button>
            <Button variant="normal">{g.variants.normal}</Button>
            <Button variant="text">{g.variants.text}</Button>
            <Button variant="normal" disabled>
              {g.variants.disabled}
            </Button>
            <Button variant="normal" autoFocus>
              {zh.area.change}
            </Button>
          </Row>
          <Row label="Pill">
            <Pill label={zh.status.cash}>
              <span className="text-cap text-muted">{zh.status.cash}</span>
              <MoneyText kind="yuan" amount={S.cashFen} className="text-title font-bold" />
            </Pill>
            <Pill label={zh.status.push} onClick={() => undefined}>
              <span className="text-cap text-muted">{zh.status.push}</span>
              <NumberText value={S.push} className="text-title font-bold" />
            </Pill>
            <Pill tone="soft" label={zh.status.risk}>
              <span className="text-cap text-muted">{zh.status.risk}</span>
              <span className="text-em font-bold">{zh.status.riskLevel.mid}</span>
            </Pill>
          </Row>
          <Row label="MoneyText">
            <MoneyText kind="yuan" amount={S.cashFen} />
            <MoneyText kind="yuan" amount={S.lossFen} />
            <MoneyText kind="rm" amount={S.priceSen} />
            <MoneyText kind="price" amount={S.priceSen} yuanFen={S.priceYuanFen} />
            <MoneyText kind="yuan" amount={S.cashFen} money />
          </Row>
          <Row label="NumberText">
            <NumberText value={S.stock} unit={zh.status.piece} />
            <NumberText value={S.push} delta={S.pushDelta} />
            <NumberText value={S.push} delta={-S.pushDelta} />
            <NumberText value={0} unit={zh.status.piece} warn />
          </Row>
          <Row label="Stepper">
            <div className="w-56">
              <Stepper label={zh.popups.restockQty} value={qty} step={10} unit={zh.input.piece} onChange={setQty} />
            </div>
            <div className="w-56">
              <Stepper label={zh.popups.restockQty} value={S.badQty} step={10} unit={zh.input.piece} error={zh.input.restockZeroOrMoq(String(S.moq))} onChange={() => undefined} />
            </div>
            <div className="w-56">
              <Stepper label={zh.popups.price} value={S.priceRm} step={1} decimals={2} unit={zh.input.rm} disabled onChange={() => undefined} />
            </div>
          </Row>
          <Row label="Segmented">
            <Segmented
              label={zh.popups.quote}
              value={seg}
              onChange={setSeg}
              options={[
                { value: "no", label: zh.popups.quoteNo },
                { value: "yes", label: zh.popups.quoteYes },
              ]}
            />
          </Row>
          <Row label="Bar">
            <div className="flex w-80 flex-col gap-2">
              {Object.entries(zh.popups.pushItems).map(([k, label], i) => (
                <Bar key={k} label={label} value={S.pushParts[i]} max={20} />
              ))}
              <Bar label={zh.productScores.demand} value={4} max={5} tone="gold" />
            </div>
          </Row>
          <Row label="Tag">
            <Tag text={zh.area.stateSet} tone="purchase" />
            <Tag text={zh.area.stateCarried} tone="ops" />
            <Tag text={zh.area.stateNotSet} tone="finance" />
            <Tag text={zh.area.change} tone="ink" />
            <Tag text={zh.timeline.season[3]} tone="gold" />
            <Tag text={zh.status.riskLevel.high} tone="hibiscus" />
            <Tag text={zh.area.later} tone="muted" />
            <Tag text={zh.areas.purchase} tone="sea" />
          </Row>
          <Row label="Popup">
            <Button onClick={() => setPopup(true)}>{zh.popups.stock.title}</Button>
            <Popup
              open={popup}
              title={zh.popups.stock.title}
              description={zh.popups.stock.desc}
              place="mid"
              width="popup"
              onClose={() => setPopup(false)}
              testId="gallery"
              footer={
                <>
                  <Button onClick={() => setPopup(false)}>{zh.ui.cancel}</Button>
                  <Button variant="confirm" onClick={() => setPopup(false)}>
                    {zh.ui.confirm}
                  </Button>
                </>
              }
            >
              <p className="text-body">{zh.plan.note}</p>
            </Popup>
          </Row>
          <Row label="Explain">
            <Explain text={zh.explain.rivalBid}>
              <MoneyText kind="yuan" amount={S.rivalBidFen} />
            </Explain>
          </Row>
          <Row label="CoachMark">
            <CoachMark open={coach} text={zh.coach.tips[2]} step={3} total={3} onNext={() => setCoach(false)} side="right">
              <span className="rounded-control border-2 border-ink px-3 py-1">{zh.status.push}</span>
            </CoachMark>
            <Button variant="text" onClick={() => setCoach(true)}>
              {g.sample}
            </Button>
          </Row>
        </Section>

        <Section title={g.areas}>
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            <AreaPanel
              area="purchase"
              state="notSet"
              onOpenDesk={() => undefined}
              rows={[
                { label: zh.area.stock, value: `${S.stock} ${zh.status.piece}` },
                { label: zh.area.restockOnWay, value: `${S.onWay} ${zh.status.piece}` },
              ]}
              reference={`${zh.area.expMonthly(String(S.expMonthly))}${zh.dot}${zh.area.stockDays(String(S.stockDays))}`}
              actions={[{ label: zh.popups.restockQty, value: zh.area.restockValue(String(S.stepperQty)), onChange: () => undefined }]}
            />
            <AreaPanel
              area="ops"
              state="set"
              onOpenDesk={() => undefined}
              rows={[{ label: zh.area.lastQuarter, value: zh.area.lastQuarterValue(String(S.lastWanted), String(S.lastLost)) }]}
              reference={
                <>
                  {zh.area.refPrice} <MoneyText kind="rm" amount={S.priceSen} />
                  {zh.dot}
                  {zh.area.rivalBid} <MoneyText kind="yuan" amount={S.rivalBidFen} />
                </>
              }
              actions={[
                { label: zh.area.retail, value: <MoneyText kind="rm" amount={S.priceSen} />, onChange: () => undefined },
                { label: zh.area.bulk, value: null, note: zh.area.later },
              ]}
            />
            <AreaPanel
              area="finance"
              state="carried"
              onOpenDesk={() => undefined}
              rows={[
                { label: zh.area.moneyOnWay, value: <MoneyText kind="yuan" amount={S.moneyOnWayFen} /> },
                { label: zh.area.sureIn, value: <MoneyText kind="yuan" amount={S.sureInFen} /> },
              ]}
              reference={
                <>
                  {zh.area.riskLabel} {zh.status.riskLevel.mid}
                  {zh.dot}
                  {zh.area.upgradeCost} <MoneyText kind="yuan" amount={S.upgradeCostFen} />
                </>
              }
              actions={[{ label: zh.area.riskLabel, value: zh.area.riskValue.compliance, onChange: () => undefined }]}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {(["purchase", "ops", "finance"] as const).map((a) => (
              <span key={a} className="flex items-center gap-2 text-em font-bold">
                <AreaIcon area={a} />
                {zh.areas[a]}
              </span>
            ))}
          </div>
        </Section>

        <Section title={g.stamps}>
          <div className="flex flex-wrap items-center gap-6" key={stampKey}>
            {S.stamps.map(([text, tone]) => (
              <Stamp key={text} text={zh.stamps[text]} tone={tone} animate />
            ))}
            <Stamp text={zh.stamps.gold} tone="gold" size="lg" animate />
          </div>
          <div>
            <Button variant="text" onClick={() => setStampKey((k) => k + 1)}>
              {g.sample}
            </Button>
          </div>
        </Section>

      </main>
    </div>
  );
}
