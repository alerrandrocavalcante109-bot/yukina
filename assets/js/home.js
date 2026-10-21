document.getElementById('year').textContent=new Date().getFullYear();


(function(){
const toggle=document.getElementById('menuToggle'),menu=document.getElementById('siteMenu');
if(toggle&&menu){toggle.addEventListener('click',()=>{const open=menu.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'✕':'☰'});menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰'}));document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!toggle.contains(e.target)){menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰'}})}

window.addEventListener('pageshow',()=>{if(toggle&&menu){menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰'}});
const language=document.getElementById('languageToggle');if(language)language.addEventListener('click',()=>{language.textContent=language.textContent==='Idioma: PT-BR'?'Idioma: EN (em breve)':language.textContent==='Idioma: EN (em breve)'?'Idioma: ES (em breve)':'Idioma: PT-BR'});
const now=new Date();const date=document.getElementById('footerDate');if(date)date.textContent=now.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});const year=document.getElementById('year');if(year)year.textContent=now.getFullYear();
})();
