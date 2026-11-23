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
const CATALOG = Object.fromEntries(Object.entries(RAW).map(([locale, values]) => [locale, Object.freeze(Object.fromEntries(KEYS.map((key, index) => [key, values[index]])))]));
const EXTRA = {
  "pt-BR": [
    "❄️ Não encontrei esse canal neste servidor.",
    "🌙 Você precisa da permissão **Gerenciar canais** para fazer isso.",
    "🫧 Preciso da permissão **Gerenciar canais** para alterar este canal.",
    "🌙 O canal {channel} já está bloqueado. Não alterei as permissões.",
    "🫧 Não consegui bloquear esse canal. Verifique minhas permissões.",
    "🌙 O canal possui bloqueio herdado de uma categoria ou outra configuração. Não alterei as permissões.",
    "❄️ O canal {channel} não possui bloqueio explícito para remover.",
    "🫧 Não consegui desbloquear esse canal. Verifique minhas permissões."
  ],
  "en-US": [
    "❄️ I couldn't find that channel on this server.",
    "🌙 You need **Manage Channels** permission to do this.",
    "🫧 I need **Manage Channels** permission to change this channel.",
    "🌙 Channel {channel} is already locked. No permissions were changed.",
    "🫧 I couldn't lock this channel. Check my permissions.",
    "🌙 The channel has a lock inherited from a category or another setting. No permissions were changed.",
    "❄️ Channel {channel} has no explicit lock to remove.",
    "🫧 I couldn't unlock this channel. Check my permissions."
  ],
  "es-ES": [
    "❄️ No encontré ese canal en este servidor.",
    "🌙 Necesitas el permiso **Gestionar canales** para hacerlo.",
    "🫧 Necesito el permiso **Gestionar canales** para modificar este canal.",
    "🌙 El canal {channel} ya está bloqueado. No cambié los permisos.",
    "🫧 No pude bloquear este canal. Comprueba mis permisos.",
    "🌙 El canal tiene un bloqueo heredado de una categoría u otra configuración. No cambié los permisos.",
    "❄️ El canal {channel} no tiene un bloqueo explícito que eliminar.",
    "🫧 No pude desbloquear este canal. Comprueba mis permisos."
  ],
  "fr-FR": [
    "❄️ Je n’ai pas trouvé ce salon sur ce serveur.",
    "🌙 Vous devez avoir la permission **Gérer les salons** pour effectuer cette action.",
    "🫧 J’ai besoin de la permission **Gérer les salons** pour modifier ce salon.",
    "🌙 Le salon {channel} est déjà verrouillé. Aucune permission n’a été modifiée.",
    "🫧 Impossible de verrouiller ce salon. Vérifiez mes permissions.",
    "🌙 Le salon est verrouillé par une catégorie ou un autre paramètre hérité. Aucune permission n’a été modifiée.",
    "❄️ Le salon {channel} ne possède aucun verrouillage explicite à supprimer.",
    "🫧 Impossible de déverrouiller ce salon. Vérifiez mes permissions."
  ],
  "ja-JP": [
    "❄️ このサーバーでチャンネルが見つかりません。",
    "🌙 この操作には**チャンネル管理**権限が必要です。",
    "🫧 変更するには**チャンネル管理**権限が必要です。",
    "🌙 チャンネル {channel} はすでにロックされています。権限は変更していません。",
    "🫧 ロックできませんでした。Botの権限を確認してください。",
    "🌙 カテゴリなどからロックが継承されています。権限は変更していません。",
    "❄️ チャンネル {channel} に解除できる明示的なロックはありません。",
    "🫧 ロック解除できませんでした。Botの権限を確認してください。"
  ],
  "de-DE": [
    "❄️ Ich konnte diesen Kanal auf diesem Server nicht finden.",
    "🌙 Du benötigst **Kanäle verwalten**, um dies zu tun.",
    "🫧 Ich benötige **Kanäle verwalten**, um diesen Kanal zu ändern.",
    "🌙 Kanal {channel} ist bereits gesperrt. Es wurden keine Rechte geändert.",
    "🫧 Kanal konnte nicht gesperrt werden. Überprüfe meine Rechte.",
    "🌙 Die Sperre wird von einer Kategorie oder einer anderen Einstellung übernommen. Es wurde nichts geändert.",
    "❄️ Kanal {channel} hat keine explizite Sperre zum Aufheben.",
    "🫧 Kanal konnte nicht entsperrt werden. Überprüfe meine Rechte."
  ],
  "it-IT": [
    "❄️ Non ho trovato questo canale nel server.",
    "🌙 Ti serve il permesso **Gestire i canali** per farlo.",
    "🫧 Mi serve il permesso **Gestire i canali** per modificare questo canale.",
    "🌙 Il canale {channel} è già bloccato. Non ho modificato i permessi.",
    "🫧 Non sono riuscita a bloccare il canale. Controlla i miei permessi.",
    "🌙 Il blocco è ereditato da una categoria o da un'altra impostazione. Non ho modificato i permessi.",
    "❄️ Il canale {channel} non ha un blocco esplicito da rimuovere.",
    "🫧 Non sono riuscita a sbloccare il canale. Controlla i miei permessi."
  ],
  "ko-KR": [
    "❄️ 이 서버에서 채널을 찾을 수 없습니다.",
    "🌙 이 작업에는 **채널 관리** 권한이 필요합니다.",
    "🫧 채널을 변경하려면 **채널 관리** 권한이 필요합니다.",
    "🌙 채널 {channel}은(는) 이미 잠겨 있습니다. 권한을 변경하지 않았습니다.",
    "🫧 채널을 잠글 수 없습니다. 봇 권한을 확인해 주세요.",
    "🌙 카테고리 또는 다른 설정에서 잠금이 상속되었습니다. 권한을 변경하지 않았습니다.",
    "❄️ 채널 {channel}에는 해제할 명시적 잠금이 없습니다.",
    "🫧 채널 잠금을 해제할 수 없습니다. 봇 권한을 확인해 주세요."
  ],
  "zh-CN": [
    "❄️ 在此服务器中找不到该频道。",
    "🌙 你需要 **管理频道** 权限才能执行此操作。",
    "🫧 我需要 **管理频道** 权限才能修改此频道。",
    "🌙 频道 {channel} 已经锁定。我没有更改权限。",
    "🫧 无法锁定此频道，请检查我的权限。",
    "🌙 该频道继承了类别或其他设置的锁定状态。我没有更改权限。",
    "❄️ 频道 {channel} 没有可移除的明确锁定。",
    "🫧 无法解锁此频道，请检查我的权限。"
  ],
  "zh-TW": [
    "❄️ 在此伺服器中找不到該頻道。",
    "🌙 你需要 **管理頻道** 權限才能執行此操作。",
    "🫧 我需要 **管理頻道** 權限才能修改此頻道。",
    "🌙 頻道 {channel} 已經鎖定。我沒有變更權限。",
    "🫧 無法鎖定此頻道，請檢查我的權限。",
    "🌙 頻道繼承了分類或其他設定的鎖定狀態。我沒有變更權限。",
    "❄️ 頻道 {channel} 沒有可移除的明確鎖定。",
    "🫧 無法解除此頻道鎖定，請檢查我的權限。"
  ],
  "ru-RU": [
    "❄️ Не удалось найти этот канал на сервере.",
    "🌙 Требуется разрешение **Управление каналами**.",
    "🫧 Мне нужно разрешение **Управление каналами**, чтобы изменить канал.",
    "🌙 Канал {channel} уже заблокирован. Права не изменены.",
    "🫧 Не удалось заблокировать канал. Проверьте мои права.",
    "🌙 Блокировка унаследована от категории или другой настройки. Права не изменены.",
    "❄️ На канале {channel} нет явной блокировки для снятия.",
    "🫧 Не удалось разблокировать канал. Проверьте мои права."
  ],
  "ar-SA": [
    "❄️ لم أجد هذه القناة في هذا الخادم.",
    "🌙 تحتاج إلى صلاحية **إدارة القنوات** لتنفيذ ذلك.",
    "🫧 أحتاج إلى صلاحية **إدارة القنوات** لتعديل هذه القناة.",
    "🌙 القناة {channel} مقفلة بالفعل. لم أغيّر الأذونات.",
    "🫧 تعذر قفل القناة. تحقق من أذوناتي.",
    "🌙 القفل موروث من فئة أو إعداد آخر. لم أغيّر الأذونات.",
    "❄️ لا يوجد قفل صريح على القناة {channel} لإزالته.",
    "🫧 تعذر فتح القناة. تحقق من أذوناتي."
  ],
  "hi-IN": [
    "❄️ मुझे इस सर्वर में यह चैनल नहीं मिला।",
    "🌙 इसके लिए **Manage Channels** अनुमति आवश्यक है।",
    "🫧 चैनल बदलने के लिए मुझे **Manage Channels** अनुमति चाहिए।",
    "🌙 चैनल {channel} पहले से लॉक है। मैंने अनुमतियाँ नहीं बदलीं।",
    "🫧 चैनल लॉक नहीं कर सकी। मेरी अनुमतियाँ जाँचें।",
    "🌙 चैनल किसी श्रेणी या अन्य सेटिंग से लॉक है। मैंने अनुमतियाँ नहीं बदलीं।",
    "❄️ चैनल {channel} पर हटाने के लिए कोई स्पष्ट लॉक नहीं है।",
    "🫧 चैनल अनलॉक नहीं कर सकी। मेरी अनुमतियाँ जाँचें।"
  ],
  "bn-IN": [
    "❄️ এই সার্ভারে চ্যানেলটি খুঁজে পাইনি।",
    "🌙 এটি করতে **Manage Channels** অনুমতি প্রয়োজন।",
    "🫧 চ্যানেল পরিবর্তন করতে আমার **Manage Channels** অনুমতি প্রয়োজন।",
    "🌙 {channel} চ্যানেলটি ইতিমধ্যেই লক করা। অনুমতি বদলাইনি।",
    "🫧 চ্যানেলটি লক করতে পারিনি। আমার অনুমতি পরীক্ষা করুন।",
    "🌙 বিভাগ বা অন্য সেটিং থেকে লকটি এসেছে। অনুমতি বদলাইনি।",
    "❄️ {channel} চ্যানেলে সরানোর মতো স্পষ্ট লক নেই।",
    "🫧 চ্যানেলটি আনলক করতে পারিনি। আমার অনুমতি পরীক্ষা করুন।"
  ],
  "nl-NL": [
    "❄️ Ik kon dat kanaal niet vinden op deze server.",
    "🌙 Je hebt **Kanalen beheren** nodig om dit te doen.",
    "🫧 Ik heb **Kanalen beheren** nodig om dit kanaal te wijzigen.",
    "🌙 Kanaal {channel} is al vergrendeld. Ik heb geen machtigingen gewijzigd.",
    "🫧 Ik kon dit kanaal niet vergrendelen. Controleer mijn machtigingen.",
    "🌙 De vergrendeling is overgenomen van een categorie of andere instelling. Er is niets gewijzigd.",
    "❄️ Kanaal {channel} heeft geen expliciete vergrendeling om te verwijderen.",
    "🫧 Ik kon dit kanaal niet ontgrendelen. Controleer mijn machtigingen."
  ],
  "pl-PL": [
    "❄️ Nie znaleziono tego kanału na serwerze.",
    "🌙 Potrzebujesz uprawnienia **Zarządzanie kanałami**.",
    "🫧 Potrzebuję uprawnienia **Zarządzanie kanałami**, aby zmienić kanał.",
    "🌙 Kanał {channel} jest już zablokowany. Nie zmieniono uprawnień.",
    "🫧 Nie udało się zablokować kanału. Sprawdź moje uprawnienia.",
    "🌙 Blokada jest odziedziczona z kategorii lub innego ustawienia. Nie zmieniono uprawnień.",
    "❄️ Kanał {channel} nie ma jawnej blokady do usunięcia.",
    "🫧 Nie udało się odblokować kanału. Sprawdź moje uprawnienia."
  ],
  "tr-TR": [
    "❄️ Bu sunucuda bu kanalı bulamadım.",
    "🌙 Bunun için **Kanalları Yönet** izni gerekir.",
    "🫧 Bu kanalı değiştirmek için **Kanalları Yönet** iznine ihtiyacım var.",
    "🌙 {channel} kanalı zaten kilitli. İzinleri değiştirmedim.",
    "🫧 Kanalı kilitleyemedim. İzinlerimi kontrol et.",
    "🌙 Kanal kilidi bir kategoriden veya başka ayardan devralmış. İzinleri değiştirmedim.",
    "❄️ {channel} kanalında kaldırılacak açık bir kilit yok.",
    "🫧 Kanalın kilidini açamadım. İzinlerimi kontrol et."
  ],
  "uk-UA": [
    "❄️ Не вдалося знайти цей канал на сервері.",
    "🌙 Потрібен дозвіл **Керування каналами**.",
    "🫧 Мені потрібен дозвіл **Керування каналами**, щоб змінити канал.",
    "🌙 Канал {channel} уже заблокований. Дозволи не змінено.",
    "🫧 Не вдалося заблокувати канал. Перевірте мої дозволи.",
    "🌙 Блокування успадковане від категорії або іншого налаштування. Дозволи не змінено.",
    "❄️ На каналі {channel} немає явного блокування для скасування.",
    "🫧 Не вдалося розблокувати канал. Перевірте мої дозволи."
  ],
  "vi-VN": [
    "❄️ Tôi không tìm thấy kênh đó trong máy chủ này.",
    "🌙 Bạn cần quyền **Quản lý kênh** để thực hiện việc này.",
    "🫧 Tôi cần quyền **Quản lý kênh** để thay đổi kênh này.",
    "🌙 Kênh {channel} đã bị khóa. Tôi không thay đổi quyền.",
    "🫧 Tôi không thể khóa kênh. Hãy kiểm tra quyền của tôi.",
    "🌙 Kênh kế thừa trạng thái khóa từ danh mục hoặc cài đặt khác. Tôi không thay đổi quyền.",
    "❄️ Kênh {channel} không có khóa cụ thể để gỡ bỏ.",
    "🫧 Tôi không thể mở khóa kênh. Hãy kiểm tra quyền của tôi."
  ],
  "th-TH": [
    "❄️ ไม่พบช่องนี้ในเซิร์ฟเวอร์นี้",
    "🌙 คุณต้องมีสิทธิ์ **จัดการช่อง** เพื่อดำเนินการนี้",
    "🫧 ฉันต้องมีสิทธิ์ **จัดการช่อง** เพื่อแก้ไขช่องนี้",
    "🌙 ช่อง {channel} ถูกล็อกอยู่แล้ว ฉันไม่ได้เปลี่ยนสิทธิ์",
    "🫧 ไม่สามารถล็อกช่องได้ โปรดตรวจสอบสิทธิ์ของฉัน",
    "🌙 ช่องรับสถานะล็อกจากหมวดหมู่หรือการตั้งค่าอื่น ฉันไม่ได้เปลี่ยนสิทธิ์",
    "❄️ ช่อง {channel} ไม่มีการล็อกโดยตรงให้ยกเลิก",
    "🫧 ไม่สามารถปลดล็อกช่องได้ โปรดตรวจสอบสิทธิ์ของฉัน"
  ],
  "id-ID": [
    "❄️ Saya tidak menemukan kanal itu di server ini.",
    "🌙 Kamu memerlukan izin **Kelola Kanal** untuk melakukan ini.",
    "🫧 Saya memerlukan izin **Kelola Kanal** untuk mengubah kanal ini.",
    "🌙 Kanal {channel} sudah terkunci. Saya tidak mengubah izin.",
    "🫧 Saya tidak dapat mengunci kanal. Periksa izin saya.",
    "🌙 Kanal mewarisi kunci dari kategori atau pengaturan lain. Saya tidak mengubah izin.",
    "❄️ Kanal {channel} tidak memiliki kunci eksplisit untuk dilepas.",
    "🫧 Saya tidak dapat membuka kunci kanal. Periksa izin saya."
  ],
  "ms-MY": [
    "❄️ Saya tidak menemui saluran itu dalam pelayan ini.",
    "🌙 Anda memerlukan kebenaran **Urus Saluran** untuk melakukannya.",
    "🫧 Saya memerlukan kebenaran **Urus Saluran** untuk mengubah saluran ini.",
    "🌙 Saluran {channel} sudah dikunci. Saya tidak mengubah kebenaran.",
    "🫧 Saya tidak dapat mengunci saluran. Semak kebenaran saya.",
    "🌙 Kunci diwarisi daripada kategori atau tetapan lain. Saya tidak mengubah kebenaran.",
    "❄️ Saluran {channel} tiada kunci khusus untuk dibuang.",
    "🫧 Saya tidak dapat membuka kunci saluran. Semak kebenaran saya."
  ],
  "sv-SE": [
    "❄️ Jag hittade inte kanalen på den här servern.",
    "🌙 Du behöver behörigheten **Hantera kanaler** för detta.",
    "🫧 Jag behöver **Hantera kanaler** för att ändra kanalen.",
    "🌙 Kanalen {channel} är redan låst. Jag ändrade inga behörigheter.",
    "🫧 Jag kunde inte låsa kanalen. Kontrollera mina behörigheter.",
    "🌙 Låsningen ärvs från en kategori eller annan inställning. Inget ändrades.",
    "❄️ Kanalen {channel} har ingen uttrycklig låsning att ta bort.",
    "🫧 Jag kunde inte låsa upp kanalen. Kontrollera mina behörigheter."
  ],
  "da-DK": [
    "❄️ Jeg kunne ikke finde kanalen på denne server.",
    "🌙 Du skal have tilladelsen **Administrer kanaler** for dette.",
    "🫧 Jeg skal have **Administrer kanaler** for at ændre kanalen.",
    "🌙 Kanalen {channel} er allerede låst. Ingen tilladelser blev ændret.",
    "🫧 Jeg kunne ikke låse kanalen. Kontrollér mine tilladelser.",
    "🌙 Låsningen er arvet fra en kategori eller anden indstilling. Intet blev ændret.",
    "❄️ Kanalen {channel} har ingen eksplicit lås, der kan fjernes.",
    "🫧 Jeg kunne ikke låse kanalen op. Kontrollér mine tilladelser."
  ],
  "fi-FI": [
    "❄️ En löytänyt kanavaa tältä palvelimelta.",
    "🌙 Tarvitset **Kanavien hallinta** -oikeuden tähän.",
    "🫧 Tarvitsen **Kanavien hallinta** -oikeuden kanavan muuttamiseen.",
    "🌙 Kanava {channel} on jo lukittu. En muuttanut oikeuksia.",
    "🫧 En voinut lukita kanavaa. Tarkista käyttöoikeuteni.",
    "🌙 Lukitus periytyy kategoriasta tai muusta asetuksesta. En muuttanut oikeuksia.",
    "❄️ Kanavalla {channel} ei ole poistettavaa erillistä lukitusta.",
    "🫧 En voinut avata kanavan lukitusta. Tarkista käyttöoikeuteni."
  ]
};
const EXTRA_KEYS = ["channelNotFound","moderatorChannelPermission","botChannelPermission","lockAlready","lockFailure","unlockInherited","unlockNotLocked","unlockFailure"];
for (const [locale, values] of Object.entries(EXTRA)) CATALOG[locale] = Object.freeze({ ...CATALOG[locale], ...Object.fromEntries(EXTRA_KEYS.map((key, index) => [key, values[index]])) });
function getMessage(language, key, variables = {}) {
  const template = CATALOG[language]?.[key] || CATALOG["pt-BR"][key] || key;
  return template.replace(/\{(count|channel)\}/g, (_, name) => String(variables[name] ?? ""));
}
module.exports = { CATALOG, getMessage };
