"use strict";
const RAW = {
  "pt-BR": [
    "❄️ Este comando só funciona dentro de um servidor.",
    "🌙 Você precisa da permissão **Administrador** para utilizar este comando.",
    "🌸 Foram apagadas **{count}** mensagens com sucesso!",
    "🌸 **Solicitação de banimento**",
    "🌸 **Solicitação de expulsão**",
    "🔒 O canal {channel} foi bloqueado. Para conversar, utilize outro canal disponível.",
    "🔓 O canal {channel} foi desbloqueado conforme as permissões herdadas."
  ],
  "en-US": [
    "❄️ This command only works inside a server.",
    "🌙 You need **Administrator** permission to use this command.",
    "🌸 **{count}** messages were successfully deleted!",
    "🌸 **Ban request**",
    "🌸 **Kick request**",
    "🔒 Channel {channel} has been locked. Please use another available channel to chat.",
    "🔓 Channel {channel} has been unlocked according to inherited permissions."
  ],
  "es-ES": [
    "❄️ Este comando solo funciona dentro de un servidor.",
    "🌙 Necesitas el permiso **Administrador** para usar este comando.",
    "🌸 ¡Se eliminaron **{count}** mensajes correctamente!",
    "🌸 **Solicitud de baneo**",
    "🌸 **Solicitud de expulsión**",
    "🔒 El canal {channel} ha sido bloqueado. Usa otro canal disponible para conversar.",
    "🔓 El canal {channel} ha sido desbloqueado según los permisos heredados."
  ],
  "fr-FR": [
    "❄️ Cette commande fonctionne uniquement dans un serveur.",
    "🌙 Vous devez avoir la permission **Administrateur** pour utiliser cette commande.",
    "🌸 **{count}** messages ont été supprimés avec succès !",
    "🌸 **Demande de bannissement**",
    "🌸 **Demande d’expulsion**",
    "🔒 Le salon {channel} a été verrouillé. Utilisez un autre salon disponible pour discuter.",
    "🔓 Le salon {channel} a été déverrouillé selon les permissions héritées."
  ],
  "ja-JP": [
    "❄️ このコマンドはサーバー内でのみ使用できます。",
    "🌙 このコマンドを使用するには**管理者**権限が必要です。",
    "🌸 **{count}** 件のメッセージを削除しました！",
    "🌸 **BAN申請**",
    "🌸 **キック申請**",
    "🔒 チャンネル {channel} をロックしました。会話には別のチャンネルを使用してください。",
    "🔓 チャンネル {channel} のロックを継承権限に従って解除しました。"
  ],
  "de-DE": [
    "❄️ Dieser Befehl funktioniert nur innerhalb eines Servers.",
    "🌙 Du benötigst die Berechtigung **Administrator**, um diesen Befehl zu verwenden.",
    "🌸 **{count}** Nachrichten wurden erfolgreich gelöscht!",
    "🌸 **Bann-Anfrage**",
    "🌸 **Kick-Anfrage**",
    "🔒 Der Kanal {channel} wurde gesperrt. Bitte nutze einen anderen verfügbaren Kanal.",
    "🔓 Der Kanal {channel} wurde gemäß den geerbten Berechtigungen entsperrt."
  ],
  "it-IT": [
    "❄️ Questo comando funziona solo all'interno di un server.",
    "🌙 Devi avere il permesso **Amministratore** per usare questo comando.",
    "🌸 **{count}** messaggi eliminati con successo!",
    "🌸 **Richiesta di ban**",
    "🌸 **Richiesta di espulsione**",
    "🔒 Il canale {channel} è stato bloccato. Usa un altro canale disponibile per chattare.",
    "🔓 Il canale {channel} è stato sbloccato secondo i permessi ereditati."
  ],
  "ko-KR": [
    "❄️ 이 명령어는 서버 내에서만 사용할 수 있습니다.",
    "🌙 이 명령어를 사용하려면 **관리자** 권한이 필요합니다.",
    "🌸 메시지 **{count}개**를 삭제했습니다!",
    "🌸 **차단 요청**",
    "🌸 **추방 요청**",
    "🔒 채널 {channel}이(가) 잠겼습니다. 다른 채널을 이용해 주세요.",
    "🔓 상속된 권한 설정에 따라 채널 {channel}의 잠금을 해제했습니다."
  ],
  "zh-CN": [
    "❄️ 此命令只能在服务器内使用。",
    "🌙 你需要 **管理员** 权限才能使用此命令。",
    "🌸 已成功删除 **{count}** 条消息！",
    "🌸 **封禁请求**",
    "🌸 **踢出请求**",
    "🔒 频道 {channel} 已锁定。请使用其他可用频道聊天。",
    "🔓 已根据继承的权限解锁频道 {channel}。"
  ],
  "zh-TW": [
    "❄️ 此指令只能在伺服器內使用。",
    "🌙 你需要 **管理員** 權限才能使用此指令。",
    "🌸 已成功刪除 **{count}** 則訊息！",
    "🌸 **封鎖申請**",
    "🌸 **踢出申請**",
    "🔒 頻道 {channel} 已鎖定。請使用其他可用頻道聊天。",
    "🔓 已依照繼承的權限解除頻道 {channel} 的鎖定。"
  ],
  "ru-RU": [
    "❄️ Эта команда работает только на сервере.",
    "🌙 Для использования команды нужны права **Администратора**.",
    "🌸 Успешно удалено сообщений: **{count}**!",
    "🌸 **Запрос на блокировку**",
    "🌸 **Запрос на исключение**",
    "🔒 Канал {channel} заблокирован. Используйте другой доступный канал для общения.",
    "🔓 Блокировка канала {channel} снята в соответствии с унаследованными правами."
  ],
  "ar-SA": [
    "❄️ يعمل هذا الأمر داخل الخادم فقط.",
    "🌙 تحتاج إلى صلاحية **المسؤول** لاستخدام هذا الأمر.",
    "🌸 تم حذف **{count}** رسالة بنجاح!",
    "🌸 **طلب حظر**",
    "🌸 **طلب طرد**",
    "🔒 تم قفل القناة {channel}. يرجى استخدام قناة أخرى متاحة للدردشة.",
    "🔓 تم فتح القناة {channel} وفقًا للأذونات الموروثة."
  ],
  "hi-IN": [
    "❄️ यह कमांड केवल सर्वर के अंदर काम करती है।",
    "🌙 इस कमांड का उपयोग करने के लिए **Administrator** अनुमति आवश्यक है।",
    "🌸 **{count}** संदेश सफलतापूर्वक हटाए गए!",
    "🌸 **बैन अनुरोध**",
    "🌸 **किक अनुरोध**",
    "🔒 चैनल {channel} लॉक कर दिया गया है। बातचीत के लिए कोई दूसरा चैनल इस्तेमाल करें।",
    "🔓 विरासत में मिली अनुमतियों के अनुसार चैनल {channel} अनलॉक कर दिया गया है।"
  ],
  "bn-IN": [
    "❄️ এই কমান্ডটি শুধুমাত্র সার্ভারের ভেতরে কাজ করে।",
    "🌙 এই কমান্ড ব্যবহারের জন্য **Administrator** অনুমতি প্রয়োজন।",
    "🌸 সফলভাবে **{count}**টি বার্তা মুছে ফেলা হয়েছে!",
    "🌸 **ব্যানের অনুরোধ**",
    "🌸 **বহিষ্কারের অনুরোধ**",
    "🔒 {channel} চ্যানেলটি লক করা হয়েছে। কথা বলতে অন্য উপলভ্য চ্যানেল ব্যবহার করুন।",
    "🔓 উত্তরাধিকারসূত্রে পাওয়া অনুমতি অনুযায়ী {channel} চ্যানেলটি আনলক করা হয়েছে।"
  ],
  "nl-NL": [
    "❄️ Dit commando werkt alleen binnen een server.",
    "🌙 Je hebt de machtiging **Beheerder** nodig om dit commando te gebruiken.",
    "🌸 **{count}** berichten zijn succesvol verwijderd!",
    "🌸 **Verzoek om ban**",
    "🌸 **Verzoek om verwijdering**",
    "🔒 Kanaal {channel} is vergrendeld. Gebruik een ander beschikbaar kanaal om te chatten.",
    "🔓 Kanaal {channel} is ontgrendeld volgens de overgenomen machtigingen."
  ],
  "pl-PL": [
    "❄️ Ta komenda działa tylko na serwerze.",
    "🌙 Aby użyć tej komendy, potrzebujesz uprawnienia **Administrator**.",
    "🌸 Pomyślnie usunięto **{count}** wiadomości!",
    "🌸 **Prośba o bana**",
    "🌸 **Prośba o wyrzucenie**",
    "🔒 Kanał {channel} został zablokowany. Użyj innego dostępnego kanału.",
    "🔓 Kanał {channel} został odblokowany zgodnie z odziedziczonymi uprawnieniami."
  ],
  "tr-TR": [
    "❄️ Bu komut yalnızca bir sunucuda çalışır.",
    "🌙 Bu komutu kullanmak için **Yönetici** iznine ihtiyacın var.",
    "🌸 **{count}** mesaj başarıyla silindi!",
    "🌸 **Yasaklama isteği**",
    "🌸 **Sunucudan atma isteği**",
    "🔒 {channel} kanalı kilitlendi. Sohbet etmek için başka bir kanal kullan.",
    "🔓 {channel} kanalının kilidi devralınan izinlere göre açıldı."
  ],
  "uk-UA": [
    "❄️ Ця команда працює лише на сервері.",
    "🌙 Для використання команди потрібен дозвіл **Адміністратора**.",
    "🌸 Успішно видалено **{count}** повідомлень!",
    "🌸 **Запит на блокування**",
    "🌸 **Запит на виключення**",
    "🔒 Канал {channel} заблоковано. Для спілкування скористайтеся іншим каналом.",
    "🔓 Канал {channel} розблоковано відповідно до успадкованих дозволів."
  ],
  "vi-VN": [
    "❄️ Lệnh này chỉ hoạt động trong máy chủ.",
    "🌙 Bạn cần quyền **Quản trị viên** để sử dụng lệnh này.",
    "🌸 Đã xóa thành công **{count}** tin nhắn!",
    "🌸 **Yêu cầu cấm**",
    "🌸 **Yêu cầu đuổi thành viên**",
    "🔒 Kênh {channel} đã bị khóa. Vui lòng dùng kênh khác để trò chuyện.",
    "🔓 Kênh {channel} đã được mở khóa theo quyền kế thừa."
  ],
  "th-TH": [
    "❄️ คำสั่งนี้ใช้งานได้เฉพาะภายในเซิร์ฟเวอร์เท่านั้น",
    "🌙 คุณต้องมีสิทธิ์ **ผู้ดูแลระบบ** เพื่อใช้คำสั่งนี้",
    "🌸 ลบข้อความสำเร็จ **{count}** ข้อความ!",
    "🌸 **คำขอแบน**",
    "🌸 **คำขอเตะสมาชิก**",
    "🔒 ล็อกช่อง {channel} แล้ว โปรดใช้ช่องอื่นที่เปิดให้ใช้งาน",
    "🔓 ปลดล็อกช่อง {channel} ตามสิทธิ์ที่สืบทอดแล้ว"
  ],
  "id-ID": [
    "❄️ Perintah ini hanya berfungsi di dalam server.",
    "🌙 Kamu memerlukan izin **Administrator** untuk menggunakan perintah ini.",
    "🌸 **{count}** pesan berhasil dihapus!",
    "🌸 **Permintaan ban**",
    "🌸 **Permintaan kick**",
    "🔒 Kanal {channel} telah dikunci. Gunakan kanal lain yang tersedia untuk mengobrol.",
    "🔓 Kanal {channel} telah dibuka sesuai izin yang diwariskan."
  ],
  "ms-MY": [
    "❄️ Perintah ini hanya berfungsi dalam pelayan.",
    "🌙 Anda memerlukan kebenaran **Pentadbir** untuk menggunakan perintah ini.",
    "🌸 **{count}** mesej berjaya dipadam!",
    "🌸 **Permintaan sekatan**",
    "🌸 **Permintaan tendang keluar**",
    "🔒 Saluran {channel} telah dikunci. Gunakan saluran lain yang tersedia untuk berbual.",
    "🔓 Saluran {channel} telah dibuka mengikut kebenaran yang diwarisi."
  ],
  "sv-SE": [
    "❄️ Kommandot fungerar endast på en server.",
    "🌙 Du behöver behörigheten **Administratör** för att använda kommandot.",
    "🌸 **{count}** meddelanden har tagits bort!",
    "🌸 **Begäran om avstängning**",
    "🌸 **Begäran om att sparka ut**",
    "🔒 Kanalen {channel} har låsts. Använd en annan tillgänglig kanal för att chatta.",
    "🔓 Kanalen {channel} har låsts upp enligt ärvda behörigheter."
  ],
  "da-DK": [
    "❄️ Kommandoen virker kun på en server.",
    "🌙 Du skal have tilladelsen **Administrator** for at bruge kommandoen.",
    "🌸 **{count}** beskeder blev slettet!",
    "🌸 **Anmodning om ban**",
    "🌸 **Anmodning om udsmidning**",
    "🔒 Kanalen {channel} er låst. Brug en anden tilgængelig kanal til chat.",
    "🔓 Kanalen {channel} er låst op i henhold til nedarvede tilladelser."
  ],
  "fi-FI": [
    "❄️ Tämä komento toimii vain palvelimella.",
    "🌙 Tarvitset **Järjestelmänvalvoja**-oikeuden tämän komennon käyttämiseen.",
    "🌸 **{count}** viestiä poistettiin onnistuneesti!",
    "🌸 **Porttikieltopyyntö**",
    "🌸 **Poistopyyntö**",
    "🔒 Kanava {channel} on lukittu. Käytä keskusteluun toista käytettävissä olevaa kanavaa.",
    "🔓 Kanavan {channel} lukitus avattiin perittyjen oikeuksien mukaisesti."
  ]
};
const KEYS = ["serverOnly","adminPermission","clearSuccess","banTitle","kickTitle","lockSuccess","unlockSuccess"];
const CATALOG = Object.freeze(Object.fromEntries(Object.entries(RAW).map(([locale, values]) => [locale, Object.freeze(Object.fromEntries(KEYS.map((key, index) => [key, values[index]])))])));
function getMessage(language, key, variables = {}) {
  const template = CATALOG[language]?.[key] || CATALOG["pt-BR"][key] || key;
  return template.replace(/\\{(count|channel)\\}/g, (_, name) => String(variables[name] ?? ""));
}
module.exports = { CATALOG, getMessage };
