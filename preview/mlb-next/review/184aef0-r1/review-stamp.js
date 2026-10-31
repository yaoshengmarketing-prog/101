(function reviewStamp(){
  "use strict";
  const app=document.getElementById("app");
  if(!app)return;
  const note=document.createElement("div");
  note.className="test-notice";
  note.setAttribute("role","note");
  note.innerHTML="<b>獨立測試預覽，非正式網站</b><span>原始程式版本 184aef0。2027 賽程、球員、登板及本包的 2026 上季參考為人工試跑，不是真實賽程；2026 春訓資料為完賽後回查。</span>";
  app.prepend(note);
  const pill=document.querySelector(".draft-pill");
  if(pill)pill.textContent="獨立測試預覽";
  const mastId=document.querySelector(".mast-id");
  if(mastId)mastId.textContent="原始程式 184aef0";
  if(new URLSearchParams(location.search).has("trial")){
    const brand=document.querySelector(".brand");
    if(brand)brand.setAttribute("href","index.html?trial=opening");
    document.querySelectorAll(".crumb a").forEach((link)=>{
      if(link.getAttribute("href")==="./")link.setAttribute("href","index.html?trial=opening");
    });
  }
})();
