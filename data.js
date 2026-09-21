/* 運彩 101 原型 Mock Data
 * 來源標記：
 *   snapshot = 2026-09-21 15:40（台北）由 MLB 官方數據一次性抓取的快照，非即時
 *   demo     = 純示範數值（盤口、打線狀態、更新時間）
 *   na       = 資料不足（畫面顯示「資料不足」，不得補 0）
 * 時間一律為台灣時間（UTC+8）。
 */
window.DATA = {
  meta: { snapshotAt: "2026/09/21 15:40", tz: "台灣時間 UTC+8", sports: ["MLB","NBA","NPB","CPBL","足球","網球"] },

  /* ---------- 首頁：三個日期的賽事清單 ---------- */
  days: [
    { key: "yesterday", label: "昨天", date: "9/21（一）", games: [
      g("823570","01:10","final","PHI","費城人","86-70",7,"NYM","大都會","71-85",2,"Cristopher Sánchez","L","18-6","2.93","Jonah Tong","R","2-2","4.21","Citi Field"),
      g("823329","01:35","final","KC","皇家","67-89",3,"PIT","海盜","79-77",4,"Michael Wacha","R","9-9","3.33","Lake Bachar","R","1-4","3.56","PNC Park"),
      g("824462","01:40","final","CHC","小熊","87-69",9,"CIN","紅人","72-84",1,"David Peterson","L","9-8","4.96","Rhett Lowder","R","6-12","6.01","Great American Ball Park"),
      g("824381","01:40","final","ATH","運動家","61-95",0,"CLE","守護者","81-75",1,"Jack Perkins","R","3-12","5.90","Gavin Williams","R","14-8","3.63","Progressive Field"),
      g("822922","01:40","final","BOS","紅襪","84-72",1,"TB","光芒","95-60",5,"Patrick Sandoval","L","1-7","5.15","Griffin Jax","R","8-10","3.62","Tropicana Field"),
      g("824139","02:10","final","ATL","勇士","92-64",4,"HOU","太空人","77-79",2,"Martín Pérez","L","9-9","3.04","Hunter Brown","R","6-3","3.26","Daikin Park"),
      g("824546","02:10","final","DET","老虎","73-83",1,"CWS","白襪","80-76",8,"Troy Melton","R","8-5","2.76","Davis Martin","R","9-7","3.84","Rate Field"),
      g("823001","02:15","final","WSH","國民","73-83",3,"STL","紅雀","76-80",5,"Jake Irvin","R","2-9","5.40","Quinn Mathews","L","2-3","3.65","Busch Stadium"),
      g("822844","02:35","final","TOR","藍鳥","77-79",7,"TEX","遊騎兵","78-78",2,"Spencer Miles","R","6-2","2.57","Jacob deGrom","R","11-10","3.86","Globe Life Field"),
      g("824300","03:10","final","SEA","水手","73-83",2,"COL","落磯","57-99",1,"Kade Anderson","L","2-2","4.18","Tomoyuki Sugano","R","12-11","5.36","Coors Field"),
      g("823975","04:07","final","MIN","雙城","73-83",8,"LAA","天使","60-96",0,"Dean Kremer","R","4-5","4.97","Ryan Johnson","R","5-9","4.93","Angel Stadium"),
      g("823896","04:10","final","SF","巨人","64-92",1,"LAD","道奇","96-60",3,"Matt Wilkinson","L","1-3","3.65","Jack Dreyer","L","5-2","3.28","Dodger Stadium"),
      g("823247","04:10","final","MIA","馬林魚","76-80",3,"SD","教士","87-69",7,"Sandy Alcantara","R","13-11","3.91","Walker Buehler","R","9-6","4.56","Petco Park"),
      g("825028","04:10","final","NYY","洋基","89-66",4,"AZ","響尾蛇","82-74",8,"Will Warren","R","10-6","4.02","Corbin Burnes","R","0-0","7.84","Chase Field"),
      g("824789","07:20","final","MIL","釀酒人","98-58",3,"BAL","金鶯","75-81",0,"Jacob Misiorowski","R","15-5","1.86","Brandon Young","R","9-5","3.62","Camden Yards")
    ]},
    { key: "today", label: "今天", date: "9/22（二）", games: [
      g("824787","06:35","pre","TOR","藍鳥","77-79",null,"BAL","金鶯","75-81",null,"Trey Yesavage","R","5-5","3.65","Shane Baz","R","6-15","4.11","Camden Yards",{odds:{ml:["1.78","1.88"],rl:["-1.5 2.15","+1.5 1.58"],ou:["8.0","1.85","1.82"]},lineup:"expected",hints:[]}),
      g("824221","06:40","pre","WSH","國民","73-83",null,"DET","老虎","73-83",null,"DJ Herz","L",null,null,"River Ryan","R",null,null,"Comerica Park",{odds:{ml:["1.85","1.80"],rl:["+1.5 1.55","-1.5 2.20"],ou:["8.5","1.80","1.80"]},lineup:"expected",hints:["雙方先發本季皆無大聯盟成績","國民牛棚近三日 4 人連續登板"],hasPage:true}),
      g("823169","09:45","pre","MIN","雙城","73-83",null,"SF","巨人","64-92",null,"Zebby Matthews","R","9-10","4.74","Blade Tidwell","R","1-2","4.56","Oracle Park",{odds:{ml:["1.90","1.75"],rl:["+1.5 1.50","-1.5 2.30"],ou:["7.5","1.83","1.80"]},lineup:"expected",hints:[]})
    ]},
    { key: "tomorrow", label: "明天", date: "9/23（三）", games: [
      g("823543","01:05","pre","TB","光芒","95-60",null,"NYY","洋基","89-66",null,"Nick Martinez","R","15-4","2.94","Carlos Rodón","L","6-3","2.95","Yankee Stadium",{note:"雙重賽 G1"}),
      g("824785","06:35","pre","TOR","藍鳥","77-79",null,"BAL","金鶯","75-81",null,"Max Scherzer","R","3-8","6.07","Chris Bassitt","R","8-5","4.64","Camden Yards"),
      g("824222","06:40","pre","WSH","國民","73-83",null,"DET","老虎","73-83",null,"Jackson Kent","L","1-4","6.40","Drew Anderson","R","5-6","3.62","Comerica Park"),
      g("823328","06:40","pre","STL","紅雀","76-80",null,"PIT","海盜","79-77",null,"Andre Pallante","R","12-7","3.70","Jared Jones","R","4-6","4.17","PNC Park"),
      g("823412","06:40","pre","MIL","釀酒人","98-58",null,"PHI","費城人","86-70",null,"Dustin May","R","7-9","4.61","Zack Wheeler","R","13-5","2.99","Citizens Bank Park"),
      g("824709","06:45","pre","CLE","守護者","81-75",null,"BOS","紅襪","84-72",null,"Parker Messick","L","12-9","2.57","Payton Tolle","L","9-6","3.02","Fenway Park"),
      g("823494","07:05","pre","TB","光芒","95-60",null,"NYY","洋基","89-66",null,"Drew Rasmussen","R","15-5","2.72","Max Fried","L","5-4","2.63","Yankee Stadium",{note:"雙重賽 G2"}),
      g("824867","07:15","pre","CIN","紅人","72-84",null,"ATL","勇士","92-64",null,"Brandon Williamson","L","4-4","5.56","JR Ritchie","R","1-3","5.03","Truist Park"),
      g("824061","07:40","pre","CWS","白襪","80-76",null,"KC","皇家","67-89",null,"Anthony Kay","L","9-9","4.41","Daniel Lynch IV","L","6-5","3.29","Kauffman Stadium"),
      g("824624","07:40","pre","MIA","馬林魚","76-80",null,"CHC","小熊","87-69",null,"Janson Junk","R","6-9","4.50",null,null,null,null,"Wrigley Field"),
      g("822840","08:05","pre","NYM","大都會","71-85",null,"TEX","遊騎兵","78-78",null,"Sean Manaea","L","5-7","4.74",null,null,null,null,"Globe Life Field"),
      g("824302","08:40","pre","AZ","響尾蛇","82-74",null,"COL","落磯","57-99",null,"Michael Soroka","R","8-5","3.45","Kyle Freeland","L","4-10","6.38","Coors Field"),
      g("824953","09:40","pre","LAA","天使","60-96",null,"ATH","運動家","61-95",null,"Yusei Kikuchi","L","1-6","5.02","Brady Basso","L","1-3","4.50","Sutter Health Park"),
      g("823089","09:40","pre","HOU","太空人","77-79",null,"SEA","水手","73-83",null,"Cristian Javier","R","2-6","5.31","Logan Gilbert","R","12-10","3.69","T-Mobile Park"),
      g("823166","09:45","pre","MIN","雙城","73-83",null,"SF","巨人","64-92",null,"Taj Bradley","R","11-6","3.81","Anthony Molina","R","3-1","4.18","Oracle Park"),
      g("823897","10:10","pre","SD","教士","87-69",null,"LAD","道奇","96-60",null,"Michael King","R","12-9","3.03",null,null,null,null,"Dodger Stadium")
    ]}
  ],

  /* ---------- 單場頁：以 gamePk 為 key，game.html?pk=xxx 選場 ---------- */
  games: { "824221": {
    pk: "824221", sport: "MLB", dateLabel: "9/22（二）", time: "9/22（二）06:40", venue: "Comerica Park（底特律）", status: "賽前", updatedAt: "2026/09/21 15:40",
    lineup: "expected",
    away: { ab:"WSH", name:"華盛頓國民", full:"Washington Nationals", rec:"73-83", pct:".468", home:"37-41", road:"36-42", l10:"6-4", rs:798, ra:786, gp:156, streak:"1 連敗", rank:"國聯東區第 4",
      ops:".747", bpEra:"5.04",
      sp: { name:"DJ Herz", hand:"L", age:25, mlb2026:null,
            mlbLast:{year:2024, wl:"4-9", era:"4.16", whip:"1.26", ip:"88.2", gs:19, so:106, bb:36, avg:".224"},
            aaa2026:{team:"Rochester（3A）", wl:"0-1", era:"5.54", whip:"1.23", ip:"13.0", gs:4, so:12, bb:4},
            last5:[["8/26","Buffalo（3A）","2.0",1,0,2,2,41],["9/01","Syracuse（3A）","2.1",7,6,1,0,50],["9/06","Syracuse（3A）","4.1",2,1,4,0,58],["9/11","Scranton（3A）","4.1",2,1,5,2,65]],
            note:"2025 全年未出賽；2026 僅 3A 4 場先發，本季大聯盟尚無成績。" },
      hit: { season:{avg:".247",obp:".322",slg:".425",ops:".747",rpg:"5.12",hr:203,so:1300,bb:540,g:156},
             l10:null,
             month:{avg:".236",obp:".302",slg:".375",ops:".677",rpg:"4.50",hr:11,so:140,bb:51,g:16},
             vl:{avg:".261",obp:".336",slg:".438",ops:".774",rpg:null,hr:57,so:425,bb:164,g:135},
             vr:{avg:".241",obp:".317",slg:".419",ops:".736",rpg:null,hr:146,so:875,bb:376,g:156} },
      bullpen: { era:"5.04", whip:"1.46", avg:".260", kpct:"18.8%", kNote:"581/3086 打席",
                 ip3:"11.2", arms3:8, consec:4, consecNames:"Sinclair、Tolman、Cruz、Dion", closer:"Will Dion", closerY:true, closerNp:29,
                 log:[["9/18","Brad Lord 2.0/28、Jack Sinclair 1.0/11、Josiah Gray 1.0/8"],["9/19","Lovelady 0.2/23、Sinclair 1.1/13、Tolman 0.1/14、Cruz 0.2/10、Cornelio 1.2/33、Dion 0.1/2（救援）"],["9/20","Dion 1.2/29、Tolman 0.2/13、Cruz 0.1/16"]] },
      last5:[["9/15","主","PHI","6-3","勝","Jackson Kent","9",null],["9/16","主","PHI","0-3","敗","Jared Simpson","3",null],["9/18","客","STL","9-1","勝","Cade Cavalli","10",null],["9/19","客","STL","8-5","勝","Andrew Alvarez","13",null],["9/20","客","STL","3-5","敗","Jake Irvin","8",null]]
    },
    home: { ab:"DET", name:"底特律老虎", full:"Detroit Tigers", rec:"73-83", pct:".468", home:"39-36", road:"34-47", l10:"6-4", rs:697, ra:629, gp:156, streak:"2 連敗", rank:"美聯中區第 4",
      ops:".717", bpEra:"3.83",
      sp: { name:"River Ryan", hand:"R", age:28, mlb2026:null,
            mlbLast:{year:2024, wl:"1-0", era:"1.33", whip:"1.18", ip:"20.1", gs:4, so:18, bb:9, avg:".208"},
            aaa2026:{team:"Oklahoma City／Toledo（3A）", wl:"3-1", era:"4.39", whip:"1.34", ip:"41.0", gs:10, so:47, bb:9},
            last5:[["6/10","Charlotte（3A）","4.0",6,1,7,1,83],["6/17","Sacramento（3A）","4.1",10,8,3,1,89],["9/09","Iowa（3A）","2.0",2,0,2,0,23],["9/15","Louisville（3A）","2.2",5,2,2,1,39]],
            note:"2025 全年未出賽；2026 在 3A 10 場先發，9 月兩場皆未滿 3 局，本季大聯盟尚無成績。" },
      hit: { season:{avg:".240",obp:".319",slg:".398",ops:".717",rpg:"4.47",hr:173,so:1354,bb:558,g:156},
             l10:null,
             month:{avg:".261",obp:".348",slg:".410",ops:".758",rpg:"5.26",hr:17,so:179,bb:80,g:19},
             vl:{avg:".237",obp:".320",slg:".381",ops:".701",rpg:null,hr:39,so:398,bb:172,g:136},
             vr:{avg:".242",obp:".318",slg:".405",ops:".723",rpg:null,hr:134,so:956,bb:386,g:156} },
      bullpen: { era:"3.83", whip:"1.28", avg:".235", kpct:"21.9%", kNote:"536/2450 打席",
                 ip3:"15.0", arms3:8, consec:0, consecNames:"—", closer:"Kenley Jansen", closerY:false, closerNp:null,
                 log:[["9/18","Brieske 2.1/49、Hurter 1.2/21、Kinley 1.1/17、Sommers 2.0/22、Jansen 1.0/10（救援）"],["9/19","Waguespack 2.0/31"],["9/20","Holton 0.1/22、Madden 3.0/48、Hurter 1.0/25"]] },
      last5:[["9/16","客","TOR","1-5","敗","Keider Montero","6",null],["9/17","客","CWS","1-3","敗","Framber Valdez","4",null],["9/18","客","CWS","11-8","勝","Andrew Sears","19",null],["9/19","客","CWS","1-3","敗","Jackson Jobe","4",null],["9/20","客","CWS","1-8","敗","Troy Melton","9",null]]
    },
    odds: { /* demo */
      tw: { ml:["1.85","1.80"], rl:["國民 +1.5","1.55","老虎 -1.5","2.20"], ou:["8.5","1.80","1.80"], updated:"09/21 15:00" },
      intl: { open:{ml:["+105","-115"], rl:["+1.5 -165","-1.5 +145"], ou:"8.5"}, now:{ml:["+100","-110"], rl:["+1.5 -170","-1.5 +150"], ou:"8.0"}, updated:"09/21 15:30" }
    },
    note: "雙方先發目前可用的大聯盟樣本有限，單看 ERA 不足以形成明確比較。老虎整季牛棚表現較佳，但仍需搭配近三日實際使用量判讀。本場賽前主要觀察點為正式打線與兩隊牛棚可用情況。"
  } }
};

function g(pk,time,status,aAb,aName,aRec,aScore,hAb,hName,hRec,hScore,aSp,aHand,aWl,aEra,hSp,hHand,hWl,hEra,venue,extra){
  return Object.assign({pk,time,status,venue,
    away:{ab:aAb,name:aName,rec:aRec,score:aScore,sp:aSp?{name:aSp,hand:aHand,wl:aWl,era:aEra}:null},
    home:{ab:hAb,name:hName,rec:hRec,score:hScore,sp:hSp?{name:hSp,hand:hHand,wl:hWl,era:hEra}:null},
    odds:null,lineup:"expected",hints:[]},extra||{});
}
