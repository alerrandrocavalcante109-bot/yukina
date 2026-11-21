"use strict";

// Mensagens do comando de saldo e dos aliases atm/bal.
// Placeholders: {amount}, {currency}, {symbol}, {name}, {rank}, {total}.
const CATALOG = Object.freeze({
  "pt-BR": {
    serverOnly: "❄️ Este comando só pode ser usado dentro de um servidor.",
    self: "💰 Você tem **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** tem **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Rank global de KZ:** #{rank} de {total} usuário(s) no ranking."
  },
  "en-US": {
    serverOnly: "❄️ This command can only be used inside a server.",
    self: "💰 You have **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** has **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Global KZ rank:** #{rank} of {total} user(s) in the ranking."
  },
  "es-ES": {
    serverOnly: "❄️ Este comando solo se puede usar dentro de un servidor.",
    self: "💰 Tienes **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** tiene **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Clasificación global de KZ:** #{rank} de {total} usuario(s)."
  },
  "fr-FR": {
    serverOnly: "❄️ Cette commande ne peut être utilisée que dans un serveur.",
    self: "💰 Tu possèdes **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** possède **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Classement mondial KZ :** #{rank} sur {total} utilisateur(s)."
  },
  "ja-JP": {
    serverOnly: "❄️ このコマンドはサーバー内でのみ使用できます。",
    self: "💰 所持金：**{amount} {currency} ({symbol})**。",
    other: "💰 **{name}** の所持金：**{amount} {currency} ({symbol})**。",
    rank: "\\n🏆 **KZ世界ランキング：** {total}人中 #{rank} 位。"
  },
  "de-DE": {
    serverOnly: "❄️ Dieser Befehl kann nur innerhalb eines Servers verwendet werden.",
    self: "💰 Du hast **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** hat **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Globaler KZ-Rang:** Platz #{rank} von {total} Nutzer(n)."
  },
  "it-IT": {
    serverOnly: "❄️ Questo comando può essere usato solo all'interno di un server.",
    self: "💰 Hai **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** ha **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Classifica globale KZ:** #{rank} su {total} utente/i."
  },
  "ko-KR": {
    serverOnly: "❄️ 이 명령어는 서버 내에서만 사용할 수 있습니다.",
    self: "💰 보유 금액: **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}**님의 보유 금액: **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **KZ 전체 순위:** 총 {total}명 중 #{rank}위."
  },
  "zh-CN": {
    serverOnly: "❄️ 此命令只能在服务器内使用。",
    self: "💰 你拥有 **{amount} {currency} ({symbol})**。",
    other: "💰 **{name}** 拥有 **{amount} {currency} ({symbol})**。",
    rank: "\\n🏆 **KZ全球排名：** 共 {total} 位用户，排名第 #{rank}。"
  },
  "zh-TW": {
    serverOnly: "❄️ 此指令只能在伺服器內使用。",
    self: "💰 你擁有 **{amount} {currency} ({symbol})**。",
    other: "💰 **{name}** 擁有 **{amount} {currency} ({symbol})**。",
    rank: "\\n🏆 **KZ全球排名：** 共 {total} 位使用者，排名第 #{rank}。"
  },
  "ru-RU": {
    serverOnly: "❄️ Эту команду можно использовать только на сервере.",
    self: "💰 У вас **{amount} {currency} ({symbol})**.",
    other: "💰 У пользователя **{name}** есть **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Глобальный рейтинг KZ:** #{rank} из {total} пользователей."
  },
  "ar-SA": {
    serverOnly: "❄️ يمكن استخدام هذا الأمر داخل الخادم فقط.",
    self: "💰 لديك **{amount} {currency} ({symbol})**.",
    other: "💰 لدى **{name}** مبلغ **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **الترتيب العالمي لـ KZ:** المركز #{rank} من أصل {total} مستخدم."
  },
  "hi-IN": {
    serverOnly: "❄️ इस कमांड का उपयोग केवल सर्वर के अंदर किया जा सकता है।",
    self: "💰 आपके पास **{amount} {currency} ({symbol})** हैं।",
    other: "💰 **{name}** के पास **{amount} {currency} ({symbol})** हैं।",
    rank: "\\n🏆 **वैश्विक KZ रैंक:** कुल {total} उपयोगकर्ताओं में #{rank}।"
  },
  "bn-IN": {
    serverOnly: "❄️ এই কমান্ডটি শুধুমাত্র সার্ভারের ভেতরে ব্যবহার করা যাবে।",
    self: "💰 আপনার কাছে **{amount} {currency} ({symbol})** আছে।",
    other: "💰 **{name}**-এর কাছে **{amount} {currency} ({symbol})** আছে।",
    rank: "\\n🏆 **বিশ্বব্যাপী KZ র‍্যাঙ্ক:** {total} জনের মধ্যে #{rank}।"
  },
  "nl-NL": {
    serverOnly: "❄️ Dit commando kan alleen binnen een server worden gebruikt.",
    self: "💰 Je hebt **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** heeft **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Wereldwijde KZ-rang:** #{rank} van {total} gebruiker(s)."
  },
  "pl-PL": {
    serverOnly: "❄️ Tej komendy można używać tylko na serwerze.",
    self: "💰 Masz **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** ma **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Globalny ranking KZ:** miejsce #{rank} z {total} użytkowników."
  },
  "tr-TR": {
    serverOnly: "❄️ Bu komut yalnızca bir sunucuda kullanılabilir.",
    self: "💰 **{amount} {currency} ({symbol})** bakiyen var.",
    other: "💰 **{name}** kullanıcısının bakiyesi **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Küresel KZ sıralaması:** {total} kullanıcı arasında #{rank}."
  },
  "uk-UA": {
    serverOnly: "❄️ Цю команду можна використовувати лише на сервері.",
    self: "💰 У вас **{amount} {currency} ({symbol})**.",
    other: "💰 У користувача **{name}** є **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Глобальний рейтинг KZ:** #{rank} із {total} користувачів."
  },
  "vi-VN": {
    serverOnly: "❄️ Lệnh này chỉ có thể được sử dụng trong máy chủ.",
    self: "💰 Bạn có **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** có **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Xếp hạng KZ toàn cầu:** #{rank} trên tổng {total} người dùng."
  },
  "th-TH": {
    serverOnly: "❄️ คำสั่งนี้ใช้ได้เฉพาะภายในเซิร์ฟเวอร์เท่านั้น",
    self: "💰 คุณมี **{amount} {currency} ({symbol})**",
    other: "💰 **{name}** มี **{amount} {currency} ({symbol})**",
    rank: "\\n🏆 **อันดับ KZ ทั่วโลก:** อันดับที่ #{rank} จาก {total} ผู้ใช้"
  },
  "id-ID": {
    serverOnly: "❄️ Perintah ini hanya dapat digunakan di dalam server.",
    self: "💰 Kamu memiliki **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** memiliki **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Peringkat global KZ:** #{rank} dari {total} pengguna."
  },
  "ms-MY": {
    serverOnly: "❄️ Perintah ini hanya boleh digunakan dalam pelayan.",
    self: "💰 Anda mempunyai **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** mempunyai **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Kedudukan global KZ:** #{rank} daripada {total} pengguna."
  },
  "sv-SE": {
    serverOnly: "❄️ Kommandot kan endast användas på en server.",
    self: "💰 Du har **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** har **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Global KZ-rankning:** #{rank} av {total} användare."
  },
  "da-DK": {
    serverOnly: "❄️ Denne kommando kan kun bruges på en server.",
    self: "💰 Du har **{amount} {currency} ({symbol})**.",
    other: "💰 **{name}** har **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **Global KZ-rangering:** #{rank} ud af {total} brugere."
  },
  "fi-FI": {
    serverOnly: "❄️ Tätä komentoa voi käyttää vain palvelimella.",
    self: "💰 Sinulla on **{amount} {currency} ({symbol})**.",
    other: "💰 Käyttäjällä **{name}** on **{amount} {currency} ({symbol})**.",
    rank: "\\n🏆 **KZ-maailmanlaajuinen sijoitus:** #{rank}/{total} käyttäjää."
  }
});

function getMessage(language, key, variables = {}) {
  const template = CATALOG[language]?.[key] || CATALOG["pt-BR"][key];
  return template.replace(/\\{(amount|currency|symbol|name|rank|total)\\}/g, (_, name) => String(variables[name] ?? ""));
}

module.exports = { CATALOG, getMessage };
