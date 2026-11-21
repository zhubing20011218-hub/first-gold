// 新版的入口：一个画面接一个画面
import "./next.css";
import { Stage } from "./parts";
import { useNext } from "./store/store";
import { HomeScreen } from "./screens/HomeScreen";
import { MapScreen } from "./screens/MapScreen";
import { ShopScreen } from "./screens/ShopScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { EndingScreen } from "./screens/EndingScreen";

// 开发时把 store 挂到 window 上，截图脚本用它一步步走（正式版里没有）
if (import.meta.env.DEV) Object.assign(window, { __next: useNext });

export function NextApp() {
  const screen = useNext((s) => s.screen);
  const mapView = useNext((s) => s.mapView);
  return (
    <Stage>
      {screen === "home" && <HomeScreen />}
      {screen === "map" && <MapScreen />}
      {screen === "shop" && (mapView ? <MapScreen /> : <ShopScreen />)}
      {screen === "play" && <PlayScreen />}
      {screen === "report" && <ReportScreen />}
      {screen === "ending" && <EndingScreen />}
    </Stage>
  );
}
