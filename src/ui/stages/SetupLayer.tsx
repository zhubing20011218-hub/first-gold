// 开局（docs/07 第四节）：三张商品卡、两张发货方式卡、第一批进货
import clsx from "clsx";
import * as Slider from "@radix-ui/react-slider";
import { Button } from "../components/base/Button";
import { Bar } from "../components/base/Bar";
import { useStore } from "../store/store";
import { params as P, firstStockCost, maxFirstStock, setupCards, formatRM, formatYuan, type Fulfillment } from "../store/selectors";
import { products } from "../../products/catalog";
import { zh } from "../../text/zh";

export function SetupLayer() {
  const ui = useStore();
  const { productId, fulfillment, firstStockQty } = ui.setup;
  const cards = setupCards(ui.seed, products);
  const product = products.find((p) => p.id === productId) ?? null;
  const cash = P.startCashFen.value;
  const max = product && fulfillment ? maxFirstStock(cash, fulfillment, product, P) : 0;
  const cost = product && fulfillment ? firstStockCost(cash, firstStockQty, fulfillment, product, P) : null;
  const canOpen = Boolean(product && fulfillment && cost && cost.leftFen >= 0 && firstStockQty >= (product?.moq ?? 0) && firstStockQty <= max);
  const s = zh.setup;
  return (
    <div className="absolute inset-x-6 bottom-4 z-10 mx-auto flex h-setup max-w-content flex-col gap-2 rounded-dialog border-2 border-ink bg-paper px-4 py-3 max-md:inset-x-4 max-md:h-auto max-md:max-h-setup-m">
      {/* 手机上内容多，在面板里面这一层上下滚动（不让整块面板滚动：它盖在 3D 画布上时，有的浏览器会把画布画成白的） */}
      <div className="grid min-h-0 flex-1 grid-cols-setup gap-4 max-md:grid-cols-1 max-md:overflow-y-auto">
        <section className="flex flex-col gap-2">
          <h3 className="text-em font-bold">{s.step1}</h3>
          {cards.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === productId}
              onClick={() => ui.pickProduct(p.id)}
              className={clsx("flex flex-col gap-1 rounded-control border-2 border-ink px-3 py-2 text-left shadow-solid-sm", p.id === productId ? "bg-sea-soft" : "bg-paper hover:bg-sea-soft")}
            >
              <span className="flex items-baseline justify-between">
                <span className="text-em font-bold">{zh.products[p.id].name}</span>
                <span className="text-cap text-muted">
                  {zh.productKind[p.kind]}
                  {zh.dot}
                  {formatRM(p.refPriceSen)}
                </span>
              </span>
              <span className="truncate text-cap text-muted">{p.id === productId ? zh.products[p.id].caution : zh.products[p.id].intro}</span>
            </button>
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className={clsx("text-em font-bold", !productId && "text-muted")}>{s.step2}</h3>
          <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
          {(["cross", "local"] as Fulfillment[]).map((f) => (
            <button
              key={f}
              type="button"
              disabled={!productId}
              aria-pressed={f === fulfillment}
              onClick={() => ui.pickFulfillment(f)}
              className={clsx("flex flex-col rounded-control border-2 border-ink px-3 py-2 text-left shadow-solid-sm disabled:opacity-50", f === fulfillment ? "bg-sea-soft" : "bg-paper")}
            >
              <span className="text-em font-bold">{s.fulfillment[f]}</span>
              <dl className="grid grid-cols-setup-dl gap-x-2 text-cap">
                {s.rows.map((r, i) => (
                  <div key={r} className="contents">
                    <dt className="text-muted">{r}</dt>
                    <dd>{f === "cross" ? s.cross[i] : s.local[i]}</dd>
                  </div>
                ))}
              </dl>
            </button>
          ))}
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className={clsx("text-em font-bold", !fulfillment && "text-muted")}>{s.step3}</h3>
          {product && fulfillment && cost ? (
            <>
              <Slider.Root
                className="relative flex h-hit w-full touch-none items-center select-none"
                min={product.moq}
                max={Math.max(product.moq, max)}
                step={10}
                value={[firstStockQty]}
                onValueChange={(v) => ui.setFirstStock(v[0])}
                aria-label={s.step3}
              >
                <Slider.Track className="relative h-3 grow rounded-full border-2 border-ink bg-paper">
                  <Slider.Range className="absolute h-full rounded-full bg-sea" />
                </Slider.Track>
                <Slider.Thumb className="block h-8 w-8 rounded-full max-md:h-hit max-md:w-hit border-2 border-ink bg-gold shadow-solid-sm" />
              </Slider.Root>
              <p className="num text-em">{s.firstStock(String(firstStockQty), formatYuan(cost.costFen + cost.setupFen), formatYuan(cost.leftFen))}</p>
              {cost.leftFen < 0 && <p className="text-cap text-hibiscus-text">{s.notEnough}</p>}
              {product && (
                <span className="flex flex-col gap-1">
                  {Object.entries(product.scores).map(([k, v]) => (
                    <Bar key={k} label={zh.productScores[k]} value={v} max={5} tone="gold" showValue={false} />
                  ))}
                </span>
              )}
            </>
          ) : (
            <p className="text-body text-muted">{s.pickFirst}</p>
          )}
          <div className="mt-auto flex justify-end gap-3">
            <Button onClick={() => ui.backHome()}>{s.back}</Button>
            <Button variant="primary" disabled={!canOpen} onClick={() => ui.openShop()}>
              {s.open}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
