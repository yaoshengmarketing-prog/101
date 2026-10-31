import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."), dir=path.join(root,"preview/mlb-next");
const win={};
for(const file of ["fixture.js","trial-data.js","same-game-data.js"]) vm.runInNewContext(fs.readFileSync(path.join(dir,file),"utf8"),{window:win});
const appJs=fs.readFileSync(path.join(dir,"app.js"),"utf8");
const render=(page,search)=>{
  const app={innerHTML:""},els={".mast-id":{},".brand":{},".site-foot":{}};
  vm.runInNewContext(appJs,{window:win,document:{body:{dataset:{page}},getElementById:()=>app,querySelector:k=>els[k]},
    location:{search},URLSearchParams,encodeURIComponent});
  return app.innerHTML;
};
const check=(title,condition)=>{if(!condition)throw Error("FAIL "+title);console.log("PASS "+title)};
const H=render("home","?trial=same-game");
check("首頁單場入口與台灣日期",H.includes("game.html?trial=same-game&amp;step=0")||H.includes("game.html?trial=same-game&step=0"));
check("首頁日期與美國賽程日分開",H.includes("2027/4/21")&&H.includes("美國賽程日 2027-04-20"));
const stages=Array.from({length:7},(_,i)=>render("game",`?trial=same-game&step=${i}`));
check("七個階段都進既有單場版型",stages.every(x=>x.includes("比賽總覽")&&x.includes("本場打線")&&x.includes("近期實際登板與用量")));
check("階段一未取得名單，階段二官方九棒",stages[0].includes("本場九棒尚未取得")&&stages[1].includes("測試打者 A1"));
check("上一場實際用量可讀，本日不誤稱無賽程",stages[0].includes("已取得 2 筆實際登板")
  &&stages[0].includes("本場前無其他已知登板"));
check("重算失敗顯示舊版時間且舊對位不冒充",stages[2].includes("新對位重算失敗")&&stages[2].includes("2027-04-20T20:00:00Z")
  &&stages[2].includes("本場對位版本未確認")&&!stages[2].includes("對左投 OPS .500"));
check("恢復後名單與左投分項一致",stages[3].includes("測試打者 A10")&&stages[3].includes("對左投 OPS .500"));
check("賽後部分缺值與完整分開",stages[5].includes("已完賽・資料未齊")&&stages[5].includes("未打")&&stages[5].includes("7上得分")
  &&stages[6].includes("完賽・資料完整")&&stages[6].includes("展開當時保存的賽前研究資料"));
check("賽後回看仍讀凍結的先發與官方九棒",stages[6].includes("測試先發 B2")&&stages[6].includes("測試打者 A10"));
check("每一步可返回首頁，原版舊入口仍可用",stages.every(x=>x.includes("index.html?trial=same-game"))
  &&render("game","?trial=small").includes("本季少樣本"));
console.log("PASS 10/10 preview checks");
