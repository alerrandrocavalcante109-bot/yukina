(() => {
  if (window.YukinaPendingChanges) return;
  const systems = new Map();
  let activeId = null;
  const style = document.createElement("style");
  style.textContent = `
    #yukina-pending-bar{position:fixed;z-index:1000;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translate(-50%,18px);width:min(440px,calc(100vw - 28px));padding:14px 16px;border:1px solid #ffffff2c;border-radius:16px;background:rgba(30,20,48,.96);box-shadow:0 12px 38px #08041080;backdrop-filter:blur(18px);color:#fff;opacity:0;visibility:hidden;transition:opacity .2s,transform .2s,visibility .2s;font:inherit}
    #yukina-pending-bar.visible{opacity:1;visibility:visible;transform:translate(-50%,0)}
    #yukina-pending-bar .ypb-message{margin:0 0 11px;font-size:.92rem;font-weight:750;text-align:center}
    #yukina-pending-bar .ypb-actions{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
    #yukina-pending-bar .ypb-result{flex:0 1 auto;max-width:100%;min-height:1.2em;text-align:center;font-size:.82rem;color:#d9fbe5}
    #yukina-pending-bar .ypb-result.error{color:#fecaca}
    #yukina-pending-bar button{min-width:104px;padding:9px 15px;border-radius:10px;font:inherit;font-weight:750;cursor:pointer}
    #yukina-pending-reset{border:1px solid #ffffff38;background:transparent;color:#fff}
    #yukina-pending-save{border:1px solid #c4b5fd;background:#c4b5fd;color:#24133e}
    @media(prefers-reduced-motion:reduce){#yukina-pending-bar{transition:none}}
  `;
  document.head.appendChild(style);
  const bar=document.createElement("div");
  bar.id="yukina-pending-bar";
  bar.setAttribute("role","status");
  bar.innerHTML='<p class="ypb-message">Alterações feitas</p><div class="ypb-actions"><button id="yukina-pending-reset" type="button">Resetar</button><button id="yukina-pending-save" type="button">Salvar</button><span class="ypb-result" id="yukina-pending-result" aria-live="polite"></span></div>';
  document.body.appendChild(bar);
  const msg=bar.querySelector(".ypb-message");
  const result=bar.querySelector("#yukina-pending-result");
  let hideTimer=null;
  function show(id){activeId=id;bar.classList.add("visible");}
  function hide(){bar.classList.remove("visible");activeId=null;}
  function clearHideTimer(){if(hideTimer){clearTimeout(hideTimer);hideTimer=null;}}
  function update(){const dirty=[...systems.values()].filter(s=>s.isDirty());if(!dirty.length){hide();return;}clearHideTimer();result.textContent="";result.classList.remove("error");const s=dirty[dirty.length-1];show(s.id);msg.textContent=dirty.length>1?"Alterações feitas em vários sistemas":"Alterações feitas";}
  async function save(){const dirty=[...systems.values()].filter(s=>s.isDirty());if(!dirty.length)return;clearHideTimer();result.textContent="Salvando…";result.classList.remove("error");const saveButton=bar.querySelector("#yukina-pending-save");saveButton.disabled=true;try{for(const s of dirty)await s.save();result.textContent="Configurações salvas";result.classList.remove("error");msg.textContent="Tudo certo!";hideTimer=setTimeout(()=>{hide();result.textContent="";},2800);}catch(e){result.textContent=e?.message||"Erro ao salvar as configurações.";result.classList.add("error");msg.textContent="Não foi possível salvar";show(activeId||dirty[dirty.length-1]?.id);}finally{saveButton.disabled=false;}}
  function reset(){clearHideTimer();const dirty=[...systems.values()].filter(s=>s.isDirty());for(const s of dirty){try{s.reset();}catch(_){}}result.textContent="Alterações descartadas";result.classList.remove("error");hideTimer=setTimeout(()=>{hide();result.textContent="";},1800);}
  bar.querySelector("#yukina-pending-save").addEventListener("click",save);
  bar.querySelector("#yukina-pending-reset").addEventListener("click",reset);
  window.YukinaPendingChanges={
    register(config){const id=config.id||("system-"+Math.random().toString(36).slice(2));const entry={...config,id};systems.set(id,entry);update();return {changed:update,unregister(){systems.delete(id);update();}};},
    refresh:update
  };
  document.addEventListener("input",e=>{if(e.target.matches("[data-yukina-track]"))update();});
  function valueOf(el){if(el.type==="checkbox"||el.type==="radio")return el.checked;return el.value;}
  function restore(el,value){if(el.type==="checkbox"||el.type==="radio")el.checked=value;else el.value=value;}
  document.querySelectorAll("form").forEach((form,index)=>{
    const fields=[...form.querySelectorAll("input,select,textarea")].filter(el=>!["button","submit","reset","file"].includes(el.type));
    const initial=fields.map(valueOf);
    if(!fields.length)return;
    const entry={
      id:"form-"+index,
      isDirty:()=>fields.some((el,i)=>valueOf(el)!==initial[i]),
      reset:()=>{fields.forEach((el,i)=>restore(el,initial[i]));form.reset();},
      save:async()=>{if(typeof form.requestSubmit==="function")form.requestSubmit();else form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));}
    };
    systems.set(entry.id,entry);
    form.addEventListener("input",update);
    form.addEventListener("change",update);
  });
  update();
})();