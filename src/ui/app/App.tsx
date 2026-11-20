// 入口：?gallery=1 打开展示页（docs/09 第九节）；其他时候是首页。
// 任务 06 第三步换成 Stage（docs/12 第三节），并加上 ?demo=名字。
import { Gallery } from "../dev/Gallery";
import { Home } from "../Home";

export function App() {
  const gallery = typeof location !== "undefined" && new URLSearchParams(location.search).has("gallery");
  return gallery ? <Gallery /> : <Home />;
}
