import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),dir=path.join(root,"preview/mlb-next");
const win={};
for(const file of ["fixture.js","trial-data.js","same-game-data.js","real-games-data.js"])
  vm.runInNewContext(fs.readFileSync(path.join(dir,file),"utf8"),{window:win});
const appJs=fs.readFileSync(path.join(dir,"app.js"),"utf8");
const render=(page,search)=>{
  const app={innerHTML:""},els={".mast-id":{},".brand":{},".site-foot":{}};
  vm.runInNewContext(appJs,{window:win,document:{body:{dataset:{page}},getElementById:()=>app,querySelector:k=>els[k]},
    location:{search},URLSearchParams,encodeURIComponent});
  return app.innerHTML;
};
const check=(title,ok)=>{if(!ok)throw Error("FAIL "+title);console.log("PASS "+title)};
const home=render("home","?trial=real");
const pages=Object.fromEntries([849799,849844].map(pk=>[pk,{
  pre:render("game",`?trial=real&pk=${pk}&mode=pre`),
  post:render("game",`?trial=real&pk=${pk}&mode=post`)
}]));
check("首頁只列兩場真實比賽",home.match(/class="game-row"/g)?.length===2
  &&home.includes("game.html?trial=real&pk=849799")&&home.includes("game.html?trial=real&pk=849844"));
check("兩場賽別與台灣日期分開",home.includes("世界大賽")&&home.includes("外卡賽")
  &&home.includes("2026/10/29")&&home.includes("2026/10/2"));
check("849799 投手、九棒、對位同場",pages[849799].pre.includes("Jacob Misiorowski")
  &&pages[849799].pre.includes("Drew Rasmussen")&&pages[849799].pre.includes("Jackson Chourio")
  &&pages[849799].pre.includes("Yandy Díaz")&&pages[849799].pre.includes("對右投 OPS"));
check("849844 不串入 849799 投打",pages[849844].pre.includes("Aaron Nola")
  &&pages[849844].pre.includes("Ray Kerr")&&pages[849844].pre.includes("Trea Turner")
  &&pages[849844].pre.includes("對左投 OPS")&&!pages[849844].pre.includes("Jackson Chourio"));
check("完賽後比賽檔整體數字不冒充賽前",Object.values(pages).every(x=>
  x.pre.includes("賽前整體數值無可驗版本")&&x.pre.includes("完賽後更新的整體 OPS 不冒充當時版本")));
check("兩場情境與逐人牛棚可展開且來源時間分明",Object.values(pages).every(x=>
  x.pre.includes("值得一起看的條件")&&x.pre.includes("展開逐投手用球")&&x.pre.includes("晚於開賽")));
check("849799 有賽前相似案例，849844 缺清單照實說明",pages[849799].pre.includes("本賽前快照保留最近")
  &&pages[849844].pre.includes("沒有保存此條件的逐筆相似案例"));
check("兩場賽後比分、逐局、投手互不串場",pages[849799].post.includes("4<i>:</i>1")
  &&pages[849844].post.includes("2<i>:</i>6")&&pages[849799].post.includes("Jacob Misiorowski")
  &&pages[849844].post.includes("Aaron Nola")&&pages[849844].post.includes("未打"));
check("賽後可展開賽前，且每場可回到共同清單",Object.values(pages).every(x=>
  x.post.includes("展開當時保存的賽前研究資料")&&x.post.includes("比賽總覽")
  &&x.post.includes('href="index.html?trial=real"')));
check("不存在的 gamePk 不會借另一場內容",render("game","?trial=real&pk=123").includes("未收錄 gamePk 123"));
console.log("PASS 10/10 real multi-game preview checks");
