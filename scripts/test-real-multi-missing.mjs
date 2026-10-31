import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const source=path.join(root,"scripts/fixtures/real-2026");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mlb-real-missing-"));
const output=path.join(root,"preview/mlb-next/real-games-missing-data.js");
const check=(label,ok)=>{if(!ok)throw Error("FAIL "+label);console.log("PASS "+label)};
const run=(...args)=>spawnSync(process.execPath,[path.join(root,"scripts/real-multi-trial.mjs"),
  `--input=${temp}`,...args],{encoding:"utf8"});
try{
  fs.cpSync(source,temp,{recursive:true});
  fs.rmSync(path.join(temp,"matchup/849844.json"));
  const made=run("--test-copy","--global=MLB_REAL_GAMES_MISSING",`--output=${output}`,"--write");
  check("測試複本缺一份 matchup，兩場仍完成共同轉接",made.status===0);
  const win={};
  for(const file of ["fixture.js","trial-data.js","same-game-data.js","real-games-data.js","real-games-missing-data.js"])
    vm.runInNewContext(fs.readFileSync(path.join(root,"preview/mlb-next",file),"utf8"),{window:win});
  const data=win.MLB_REAL_GAMES_MISSING;
  check("缺項僅落在 849844，849799 對位仍在",
    data.games[849844].matchup===null&&data.games[849844].matchupStatus==="unavailable"
    &&data.games[849799].matchup?.pairs?.length===2);
  const appJs=fs.readFileSync(path.join(root,"preview/mlb-next/app.js"),"utf8");
  const render=(pk,mode="pre")=>{
    const app={innerHTML:""},els={".mast-id":{},".brand":{},".site-foot":{}};
    vm.runInNewContext(appJs,{window:win,document:{body:{dataset:{page:"game"}},
      getElementById:()=>app,querySelector:k=>els[k]},
      location:{search:`?trial=real-missing&pk=${pk}&mode=${mode}`},
      URLSearchParams,encodeURIComponent});
    return app.innerHTML;
  };
  const pre=render(849844),post=render(849844,"post");
  check("對位缺值不遮掉本場九棒、預估、上一場與情境",
    pre.includes("對位模組未取得")&&pre.includes("Trea Turner")
    &&pre.includes("RotoWire")&&pre.includes("上一場歷史參考")
    &&pre.includes("值得一起看的條件")&&!pre.includes("Jacob Misiorowski"));
  check("缺對位時同場賽後仍可回看",post.includes("2<i>:</i>6")
    &&post.includes("展開當時保存的賽前研究資料"));
  const wrong=path.join(temp,"roster/849844.json"),roster=JSON.parse(fs.readFileSync(wrong,"utf8"));
  roster.pk=849799;
  fs.writeFileSync(wrong,JSON.stringify(roster));
  const rejected=run();
  check("必要 gamePk 矛盾會拒絕，不借另一場內容",
    rejected.status!==0&&/必要身份/.test(rejected.stdout+rejected.stderr));
}finally{
  const resolved=path.resolve(temp),base=path.resolve(os.tmpdir());
  if(path.dirname(resolved)!==base||!path.basename(resolved).startsWith("mlb-real-missing-"))
    throw Error("拒絕清理未核對的測試目錄");
  fs.rmSync(resolved,{recursive:true,force:true});
}
