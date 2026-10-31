(function reviewStamp(){
  "use strict";
  const app=document.getElementById("app");
  if(!app)return;
  const trial=new URLSearchParams(location.search).get("trial");
  const note=document.createElement("div");
  note.className="test-notice";
  note.setAttribute("role","note");
  note.innerHTML=trial==="real"
    ?"<b>獨立歷史預覽，非正式網站</b><span>原始程式版本 ed27126；2026 兩場真實已保存資料固定於 e14032c。賽前保存與賽後更新時間分開標示，不代表即時來源。</span>"
    :"<b>獨立測試預覽，非正式網站</b><span>原始程式版本 ed27126。2027 賽事、球員及來源回應為人工試跑；2026 歷史回查另標資料性質。</span>";
  app.prepend(note);
  const pill=document.querySelector(".draft-pill");
  if(pill)pill.textContent="獨立測試預覽";
  const mastId=document.querySelector(".mast-id");
  if(mastId)mastId.textContent="原始程式 ed27126";
  if(trial){
    const brand=document.querySelector(".brand");
    if(brand)brand.setAttribute("href",trial==="real"?"index.html?trial=real":trial==="same-game"?"index.html?trial=same-game":"index.html?trial=opening");
  }
})();

