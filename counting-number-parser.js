"use strict";

const WORDS = {
  pt: {
    zero:0, um:1, uma:1, dois:2, duas:2, tres:3, quatro:4, cinco:5, seis:6, sete:7, oito:8, nove:9, dez:10,
    onze:11, doze:12, treze:13, catorze:14, quatorze:14, quinze:15, dezesseis:16, dezasseis:16, dezessete:17, dezassete:17,
    dezoito:18, dezenove:19, dezanove:19, vinte:20, trinta:30, quarenta:40, cinquenta:50, sessenta:60, setenta:70,
    oitenta:80, noventa:90, cem:100, cento:100, duzentos:200, trezentos:300, quatrocentos:400, quinhentos:500,
    seiscentos:600, setecentos:700, oitocentos:800, novecentos:900, mil:1000
  },
  en: {
    zero:0, oh:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
    eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19,
    twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90, hundred:100, thousand:1000
  },
  fr: {
    zero:0, un:1, une:1, deux:2, trois:3, quatre:4, cinq:5, six:6, sept:7, huit:8, neuf:9, dix:10, onze:11, douze:12,
    treize:13, quatorze:14, quinze:15, seize:16, vingt:20, trente:30, quarante:40, cinquante:50, soixante:60,
    cent:100, cents:100, mille:1000
  },
  es: {
    cero:0, un:1, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10,
    once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19,
    veinte:20, veintiuno:21, treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90,
    cien:100, ciento:100, mil:1000
  },
  it: {
    zero:0, uno:1, una:1, due:2, tre:3, quattro:4, cinque:5, sei:6, sette:7, otto:8, nove:9, dieci:10,
    undici:11, dodici:12, tredici:13, quattordici:14, quindici:15, sedici:16, diciassette:17, diciotto:18, diciannove:19,
    venti:20, trenta:30, quaranta:40, cinquanta:50, sessanta:60, settanta:70, ottanta:80, novanta:90, cento:100, mille:1000
  },
  de: {
    null:0, eins:1, ein:1, eine:1, zwei:2, drei:3, vier:4, funf:5, sechs:6, sieben:7, acht:8, neun:9, zehn:10,
    elf:11, zwolf:12, dreizehn:13, vierzehn:14, funfzehn:15, sechzehn:16, siebzehn:17, achtzehn:18, neunzehn:19,
    zwanzig:20, dreissig:30, vierzig:40, funfzig:50, sechzig:60, siebzig:70, achtzig:80, neunzig:90, hundert:100, tausend:1000
  }
};

function romanToNumber(text) {
  const s = text.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  const vals = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
  let total = 0;
  for (let i=0;i<s.length;i++) total += (vals[s[i]] < (vals[s[i+1]] || 0)) ? -vals[s[i]] : vals[s[i]];
  if (total < 1 || total > 3999) return null;
  const canonical = toRoman(total);
  return canonical === s ? total : null;
}
function toRoman(n) {
  const entries = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let out = "";
  for (const [v,s] of entries) while (n >= v) { out += s; n -= v; }
  return out;
}

function eastAsianNumber(text) {
  const s = text.replace(/[零〇]/g, "零");
  if (!/^[零一二三四五六七八九十百千万亿两壹貳贰參叁肆伍陆陸柒捌玖拾佰仟]+$/.test(s)) return null;
  const digit = {零:0,〇:0,一:1,二:2,两:2,兩:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,壹:1,貳:2,贰:2,參:3,叁:3,肆:4,伍:5,陆:6,陸:6,柒:7,捌:8,玖:9};
  const unit = {十:10,拾:10,百:100,佰:100,千:1000,仟:1000,万:10000,亿:100000000};
  let total=0, section=0, number=0;
  for (const ch of s) {
    if (Object.hasOwn(digit,ch)) number = digit[ch];
    else if (unit[ch] < 10000) {
      const u = unit[ch]; section += (number || (u===10 ? 1 : 0))*u; number=0;
    } else {
      section += number; number=0;
      total += (section || 1)*unit[ch]; section=0;
    }
  }
  return total+section+number;
}

function wordsToNumber(text) {
  const normalized = text.toLocaleLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[‐‑‒–—-]/g, " ").replace(/[，,]/g, " ")
    .replace(/\b(and|et|e|y|und)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const tokens = normalized.split(" ");
  for (const lang of Object.values(WORDS)) {
    let total=0, group=0, matched=0;
    for (const token of tokens) {
      if (!Object.hasOwn(lang,token)) break;
      matched++;
      const value=lang[token];
      if (value===100 || value===1000) {
        group = Math.max(1,group)*value;
        if (value===1000) { total += group; group=0; }
      } else if (value>=100) group += value;
      else group += value;
    }
    if (matched===tokens.length && matched>0) return total+group;
  }
  return null;
}

function tokenizeMath(input) {
  const s = input
    .replace(/[×✕·]/g, "*").replace(/[÷⁄]/g, "/").replace(/−/g, "-").replace(/π/gi, " pi ")
    .replace(/√\s*\(/g, " sqrt (").replace(/√\s*(\d+(?:\.\d+)?)/g, " sqrt($1)")
    .replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/\bpi\b/gi, "pi").replace(/\bPI\b/g, "pi")
    .replace(/\b(sqrt|raiz|root)\b/gi, "sqrt");
  const tokens = s.match(/(?:\d+(?:\.\d+)?|\.\d+|sqrt|pi|[()+\-*/^])/g);
  if (!tokens || tokens.join("").replace(/\s/g,"") !== s.replace(/\s/g,"")) return null;
  return tokens;
}
function evaluateMath(input) {
  const tokens = tokenizeMath(input);
  if (!tokens) return null;
  let i=0;
  const peek=()=>tokens[i];
  const eat=(v)=>{ if(peek()===v){i++;return true;} return false; };
  function primary() {
    if (eat("+")) return primary();
    if (eat("-")) return -primary();
    if (eat("(")) { const v=expr(); if(!eat(")")) throw Error("paren"); return v; }
    if (eat("sqrt")) { let v; if(eat("(")){v=expr();if(!eat(")"))throw Error("paren");}else v=primary(); if(v<0)throw Error("sqrt"); return Math.sqrt(v); }
    if (eat("pi")) return Math.PI;
    const t=peek();
    if (t && (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(t))) { i++; return Number(t); }
    throw Error("token");
  }
  function power() { let a=primary(); if(eat("^")) a=Math.pow(a,power()); return a; }
  function term() { let a=power(); while(peek()==="*"||peek()==="/"){const op=tokens[i++];const b=power();a=op==="*"?a*b:a/b;} return a; }
  function expr() { let a=term(); while(peek()==="+"||peek()==="-"){const op=tokens[i++];const b=term();a=op==="+"?a+b:a-b;} return a; }
  try {
    const value=expr();
    if(i!==tokens.length || !Number.isFinite(value)) return null;
    return value;
  } catch { return null; }
}

function parseCountingValue(raw) {
  const input=String(raw || "").trim();
  if(!input || /[\p{Extended_Pictographic}\uFE0F\u200D\u20E3\u{1F1E6}-\u{1F1FF}]/u.test(input)) return null;

  // Accept an expression at the start, preserving the existing "1 oi" style.
  const candidates=[];
  const numericPrefix=input.match(/^[0-9\s.+*\/^×÷✕·−π√()²³,，-]+/u);
  if(numericPrefix && numericPrefix[0].trim()) candidates.push(numericPrefix[0].trim().replace(/[，,]$/,""));
  const words=input.match(/^[\p{L}\p{N}\s.+\-*/^×÷✕·−π√()²³,，]+/u);
  if(words) {
    const candidate=words[0].trim().replace(/[，,]\s*$/,"").trim();
    if(candidate) candidates.push(candidate);
  }
  candidates.push(input);
  for(const candidate of [...new Set(candidates)]) {
    const math=evaluateMath(candidate);
    if(math!==null && Number.isSafeInteger(math) && math>=0) return math;
    const roman=romanToNumber(candidate.replace(/\s/g,""));
    if(roman!==null) return roman;
    const asian=eastAsianNumber(candidate.replace(/\s/g,""));
    if(asian!==null && Number.isSafeInteger(asian)) return asian;
    const wordsValue=wordsToNumber(candidate);
    if(wordsValue!==null && Number.isSafeInteger(wordsValue) && wordsValue>=0) return wordsValue;
  }
  // For number words followed by a chat suffix, accept the longest valid word prefix.
  const parts=input.split(/\s+/);
  for(let end=parts.length-1;end>0;end--) {
    const candidate=parts.slice(0,end).join(" ");
    const value=wordsToNumber(candidate);
    if(value!==null && Number.isSafeInteger(value) && value>=0) return value;
  }
  return null;
}

module.exports = { parseCountingValue, romanToNumber, evaluateMath, wordsToNumber, eastAsianNumber };
