(function reviewStamp(){
  "use strict";
  const app=document.getElementById("app");
  if(!app)return;
  const trial=new URLSearchParams(location.search).get("trial");
  const note=document.createElement("div");
  note.className="test-notice";
  note.setAttribute("role","note");
  note.innerHTML=trial==="real-missing"
    ?"<b>選配缺檔測試複本，非正式網站</b><span>原始程式 6186448。只從測試複本移除 849844 對位檔；原始 2026 保存檔完整，缺項不進研究樣本。</span>"
    :trial==="real"
      ?"<b>獨立歷史預覽，非正式網站</b><span>原始程式 6186448；真實 2026 資料固定於 e14032c。逐版來源時間與較晚保存的歷史參考分開標示。</span>"
      :"<b>獨立測試預覽，非正式網站</b><span>原始程式 6186448。2027 賽事及球員為人工試跑，不是真實賽程。</span>";
  app.prepend(note);
  document.querySelectorAll('a[href="README.md"]').forEach(link=>link.setAttribute("href","README.html"));
  const pill=document.querySelector(".draft-pill");
  if(pill)pill.textContent="獨立測試預覽";
  const mastId=document.querySelector(".mast-id");
  if(mastId)mastId.textContent="原始程式 6186448";
  if(trial){
    const brand=document.querySelector(".brand");
    if(brand)brand.setAttribute("href",trial==="real"||trial==="real-missing"
      ?`index.html?trial=${trial}`:trial==="same-game"?"index.html?trial=same-game":"index.html?trial=opening");
  }
})();

