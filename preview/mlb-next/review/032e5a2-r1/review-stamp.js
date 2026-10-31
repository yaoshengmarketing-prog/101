(function reviewStamp(){
  "use strict";
  const app=document.getElementById("app");
  if(!app)return;
  const note=document.createElement("div");
  note.className="test-notice";
  note.setAttribute("role","note");
  note.innerHTML="<b>獨立測試預覽，非正式網站</b><span>原始程式版本 032e5a2。2027 同場賽事、球員與來源回應為人工試跑，不是真實賽程；賽前至賽後結果由既有程式產出。</span>";
  app.prepend(note);
  const pill=document.querySelector(".draft-pill");
  if(pill)pill.textContent="獨立測試預覽";
  const mastId=document.querySelector(".mast-id");
  if(mastId)mastId.textContent="原始程式 032e5a2";
  if(new URLSearchParams(location.search).has("trial")){
    const brand=document.querySelector(".brand");
    if(brand)brand.setAttribute("href",new URLSearchParams(location.search).get("trial")==="same-game"?"index.html?trial=same-game":"index.html?trial=opening");
    document.querySelectorAll(".crumb a").forEach((link)=>{
      if(link.getAttribute("href")==="./")link.setAttribute("href","index.html?trial=opening");
    });
  }
})();
