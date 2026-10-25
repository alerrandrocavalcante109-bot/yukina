(() => {
  if (window.YukinaPendingChanges) return;
  const systems = new Map();
  let activeId = null;
  const style = document.createElement("style");
  style.textContent = `
    #yukina-pending-bar{position:fixed;z-index:1000;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translate(-50%,18px);width:min(440px,calc(100vw - 28px));padding:14px 16px;border:1px solid #ffffff2c;border-radius:16px;background:rgba(30,20,48,.96);box-shadow:0 12px 38px #08041080;backdrop-filter:blur(18px);color:#fff;opacity:0;visibility:hidden;transition:opacity .2s,transform .2s,visibility .2s;font:inherit}
    #yukina-pending-bar.visible{opacity:1;visibility:visible;transform:translate(-50%,0)}
    #yukina-pending-bar .ypb-message{margin:0 0 11px;font-size:.92rem;font-weight:750;text-align:center}
    #yukina-pending-bar .ypb-actions{display:flex;justify-content:center;gap:10px}
    #yukina-pending-bar button{min-width:104px;padding:9px 15px;border-radius:10px;font:inherit;font-weight:750;cursor:pointer}
    #yukina-pending-reset{border:1px solid #ffffff38;background:transparent;color:#fff}
    #yukina-pending-save{border:1px solid #c4b5fd;background:#c4b5fd;color:#24133e}
    @media(prefers-reduced-motion:reduce){#yukina-pending-bar{transition:none}}
  `;
  document.head.appendChild(style);
  const bar=document.createElement("div");
  bar.id="yukina-pending-bar";
  bar.setAttribute("role","status");
  bar.innerHTML='<p class="ypb-message">Alterações feitas</p><div class="ypb-actions"><button id="yukina-pending-reset" type="button">Resetar</button><button id="yukina-pending-save" type="button">Salvar</button></div>';
  document.body.appendChild(bar);
  const msg=bar.querySelector(".ypb-message");
  function show(id){activeId=id;bar.classList.add("visible");}
  function hide(){bar.classList.remove("visible");activeId=null;}
  function update(){const dirty=[...systems.values()].filter(s=>s.isDirty());if(!dirty.length){hide();return;}const s=dirty[dirty.length-1];show(s.id);msg.textContent=dirty.length>1?"Alterações feitas em vários sistemas":"Alterações feitas";}
  async function save(){const dirty=[...systems.values()].filter(s=>s.isDirty());for(const s of dirty){try{await s.save();}catch(e){msg.textContent=e?.message||"Não foi possível salvar as alterações.";return;}}hide();}
  function reset(){const dirty=[...systems.values()].filter(s=>s.isDirty());for(const s of dirty){try{s.reset();}catch(_){}}hide();}
  bar.querySelector("#yukina-pending-save").addEventListener("click",save);
  bar.querySelector("#yukina-pending-reset").addEventListener("click",reset);
  window.YukinaPendingChanges={
    register(config){const id=config.id||("system-"+Math.random().toString(36).slice(2));const entry={...config,id};systems.set(id,entry);update();return {changed:update,unregister(){systems.delete(id);update();}};},
    refresh:update
  };
  document.addEventListener("input",e=>{if(e.target.matches("[data-yukina-track]"))update();});
})();