// P4 风险：合规和升级成本土店（docs/09 第四节）
import { useState } from "react";
import { Segmented } from "../components/base/Segmented";
import { useStore } from "../store/store";
import { params as P, referenceOf, formatYuan } from "../store/selectors";
import { zh } from "../../text/zh";
import { DecisionShell } from "../components/biz/DecisionShell";

export function RiskPopup() {
  const ui = useStore();
  const ref = referenceOf(ui);
  const [compliance, setCompliance] = useState(ui.decision.buyCompliance);
  const [upgrade, setUpgrade] = useState(ui.decision.upgradeToLocal);
  if (!ref || !ui.game) return null;
  const local = ui.game.fulfillment === "local";
  return (
    <DecisionShell name="risk" area="finance" draft={{ buyCompliance: compliance, upgradeToLocal: upgrade }} checks={[]}>
      {local ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-em">
            {zh.popups.compliance} <span className="num">{formatYuan(P.complianceCostFen.value)}</span>
          </span>
          <Segmented
            label={zh.popups.compliance}
            value={compliance ? "yes" : "no"}
            onChange={(x) => setCompliance(x === "yes")}
            options={[
              { value: "no", label: zh.popups.no },
              { value: "yes", label: zh.popups.yes },
            ]}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <span className="text-em">
            {zh.popups.upgrade} <span className="num">{formatYuan(ref.upgradeCostFen)}</span>
          </span>
          <Segmented
            label={zh.popups.upgrade}
            value={upgrade ? "yes" : "no"}
            onChange={(x) => setUpgrade(x === "yes")}
            options={[
              { value: "no", label: zh.popups.no },
              { value: "yes", label: zh.popups.yes },
            ]}
          />
        </div>
      )}
    </DecisionShell>
  );
}
