"use strict";

// Textos do Daily escritos e mantidos manualmente.
// Placeholders: {streak}. O idioma padrão é pt-BR.
const CATALOG = Object.freeze({
  "pt-BR": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ A neve cai devagar, mas cada novo dia traz uma oportunidade. Sua recompensa diária está esperando por você!",
      "🌙 Sob a luz da lua, até os pequenos passos brilham. Passe no painel e resgate seu Daily de hoje!",
      "✨ Uma nova página, uma nova chance e uma recompensa para você. Não deixe seu Daily passar!",
      "🌸 Que seu dia seja leve como sakura ao vento. Sua recompensa diária pode ser resgatada no painel!",
      "💎 Sua jornada também merece pequenas recompensas. Visite o painel da Yukina e pegue seu Daily!"
    ],
    commandPanel: "🔗 **Painel:**",
    commandButton: "🎁 Pegar Daily no painel",
    reminderTitle: "🌸 Resgate Diário Disponível! ・🔥 Sequência: {streak} dias",
    reminderBody: "Seu presente diário de Kizunas está esperando por você! Faça seu resgate e descubra quantas Kizunas a Yukina preparou especialmente para hoje. 💜",
    reminderLink: "🔗 [Clique aqui para realizar seu resgate diário!](<{url}>)",
    reminderClosing: "**Não deixe sua sequência acabar!** Continue realizando suas coletas diariamente e mantenha sua sequência de conquistas. ✨",
    reminderSignature: "-# Yukina • Lembrete diário de Kizunas",
    imageDescription: "Imagem do resgate diário da Yukina",
    reminderButton: "Resgatar recompensa"
  },
  "en-US": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ The snow falls softly, but every new day brings an opportunity. Your daily reward is waiting for you!",
      "🌙 Beneath the moonlight, even the smallest steps shine. Visit the panel and claim today's Daily reward!",
      "✨ A new page, a new chance, and a reward just for you. Don't miss your Daily!",
      "🌸 May your day be as gentle as sakura in the breeze. Your daily reward is waiting on the panel!",
      "💎 Your journey deserves little rewards too. Visit Yukina's panel and claim your Daily!"
    ],
    commandPanel: "🔗 **Panel:**",
    commandButton: "🎁 Claim Daily on the panel",
    reminderTitle: "🌸 Daily Reward Available! ・🔥 Streak: {streak} days",
    reminderBody: "Your daily Kizunas gift is waiting for you! Claim it and discover how many Kizunas Yukina has prepared especially for today. 💜",
    reminderLink: "🔗 [Click here to claim your daily reward!](<{url}>)",
    reminderClosing: "**Don't let your streak end!** Keep claiming your rewards every day and maintain your achievement streak. ✨",
    reminderSignature: "-# Yukina • Daily Kizunas reminder",
    imageDescription: "Yukina daily reward image",
    reminderButton: "Claim reward"
  },
  "es-ES": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ La nieve cae despacio, pero cada nuevo día trae una oportunidad. ¡Tu recompensa diaria te está esperando!",
      "🌙 Bajo la luz de la luna, hasta los pasos pequeños brillan. ¡Visita el panel y recoge tu Daily de hoy!",
      "✨ Una nueva página, una nueva oportunidad y una recompensa para ti. ¡No dejes pasar tu Daily!",
      "🌸 Que tu día sea tan suave como los pétalos de sakura al viento. ¡Tu recompensa diaria está en el panel!",
      "💎 Tu camino también merece pequeñas recompensas. ¡Visita el panel de Yukina y recoge tu Daily!"
    ],
    commandPanel: "🔗 **Panel:**",
    commandButton: "🎁 Recoger Daily en el panel",
    reminderTitle: "🌸 ¡Recompensa diaria disponible! ・🔥 Racha: {streak} días",
    reminderBody: "¡Tu regalo diario de Kizunas te está esperando! Recógelo y descubre cuántas Kizunas ha preparado Yukina especialmente para hoy. 💜",
    reminderLink: "🔗 [¡Haz clic aquí para recoger tu recompensa diaria!](<{url}>)",
    reminderClosing: "**¡No dejes que termine tu racha!** Sigue recogiendo tus recompensas cada día y mantén tu racha de logros. ✨",
    reminderSignature: "-# Yukina • Recordatorio diario de Kizunas",
    imageDescription: "Imagen de la recompensa diaria de Yukina",
    reminderButton: "Recoger recompensa"
  },
  "fr-FR": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ La neige tombe doucement, mais chaque nouveau jour apporte une occasion. Ta récompense quotidienne t'attend !",
      "🌙 Sous la lumière de la lune, même les petits pas brillent. Visite le panneau et récupère ton Daily du jour !",
      "✨ Une nouvelle page, une nouvelle chance et une récompense pour toi. Ne manque pas ton Daily !",
      "🌸 Que ta journée soit légère comme les sakura dans le vent. Ta récompense quotidienne est sur le panneau !",
      "💎 Ton aventure mérite aussi de petites récompenses. Visite le panneau de Yukina et récupère ton Daily !"
    ],
    commandPanel: "🔗 **Panneau :**",
    commandButton: "🎁 Récupérer le Daily",
    reminderTitle: "🌸 Récompense quotidienne disponible ! ・🔥 Série : {streak} jours",
    reminderBody: "Ton cadeau quotidien de Kizunas t'attend ! Récupère-le et découvre combien de Kizunas Yukina a préparées spécialement pour aujourd'hui. 💜",
    reminderLink: "🔗 [Clique ici pour récupérer ta récompense quotidienne !](<{url}>)",
    reminderClosing: "**Ne laisse pas ta série s'interrompre !** Récupère tes récompenses chaque jour et conserve ta série de réussites. ✨",
    reminderSignature: "-# Yukina • Rappel quotidien de Kizunas",
    imageDescription: "Image de la récompense quotidienne de Yukina",
    reminderButton: "Récupérer la récompense"
  },
  "ja-JP": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ 雪は静かに降りますが、新しい一日には新しいチャンスがあります。デイリー報酬が待っています！",
      "🌙 月明かりの下では、小さな一歩も輝きます。パネルで今日のデイリー報酬を受け取りましょう！",
      "✨ 新しいページ、新しいチャンス、そしてあなたへの報酬。デイリーを忘れずに！",
      "🌸 風に舞う桜のように、穏やかな一日になりますように。デイリー報酬はパネルで受け取れます！",
      "💎 あなたの旅にも小さなご褒美を。Yukinaのパネルでデイリーを受け取りましょう！"
    ],
    commandPanel: "🔗 **パネル：**",
    commandButton: "🎁 パネルでデイリーを受け取る",
    reminderTitle: "🌸 デイリー報酬を受け取れます！ ・🔥 連続記録：{streak}日",
    reminderBody: "毎日のキズナのプレゼントが待っています！受け取って、Yukinaが今日のために用意したキズナの数を確認しましょう。💜",
    reminderLink: "🔗 [ここをクリックしてデイリー報酬を受け取る！](<{url}>)",
    reminderClosing: "**連続記録を途切れさせないで！** 毎日報酬を受け取り、連続記録を続けましょう。✨",
    reminderSignature: "-# Yukina • キズナのデイリー通知",
    imageDescription: "Yukinaのデイリー報酬画像",
    reminderButton: "報酬を受け取る"
  },
  "de-DE": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Der Schnee fällt leise, doch jeder neue Tag bringt eine Gelegenheit. Deine tägliche Belohnung wartet auf dich!",
      "🌙 Im Mondlicht glänzen selbst die kleinsten Schritte. Besuche das Panel und hole dir dein heutiges Daily!",
      "✨ Eine neue Seite, eine neue Chance und eine Belohnung für dich. Verpasse dein Daily nicht!",
      "🌸 Möge dein Tag so sanft sein wie Sakura im Wind. Deine tägliche Belohnung wartet im Panel!",
      "💎 Auch deine Reise verdient kleine Belohnungen. Besuche Yukinas Panel und hole dir dein Daily!"
    ],
    commandPanel: "🔗 **Panel:**",
    commandButton: "🎁 Daily im Panel abholen",
    reminderTitle: "🌸 Tägliche Belohnung verfügbar! ・🔥 Serie: {streak} Tage",
    reminderBody: "Dein tägliches Kizunas-Geschenk wartet auf dich! Hole es ab und entdecke, wie viele Kizunas Yukina heute extra für dich vorbereitet hat. 💜",
    reminderLink: "🔗 [Klicke hier, um deine tägliche Belohnung abzuholen!](<{url}>)",
    reminderClosing: "**Lass deine Serie nicht enden!** Hole deine Belohnungen jeden Tag ab und halte deine Erfolgsserie aufrecht. ✨",
    reminderSignature: "-# Yukina • Tägliche Kizunas-Erinnerung",
    imageDescription: "Bild der täglichen Yukina-Belohnung",
    reminderButton: "Belohnung abholen"
  },
  "it-IT": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ La neve cade lentamente, ma ogni nuovo giorno porta un'opportunità. La tua ricompensa giornaliera ti aspetta!",
      "🌙 Sotto la luce della luna, anche i piccoli passi brillano. Visita il pannello e riscuoti il Daily di oggi!",
      "✨ Una nuova pagina, una nuova possibilità e una ricompensa per te. Non perdere il tuo Daily!",
      "🌸 Che la tua giornata sia leggera come i sakura al vento. La tua ricompensa giornaliera ti aspetta nel pannello!",
      "💎 Anche il tuo viaggio merita piccole ricompense. Visita il pannello di Yukina e riscuoti il Daily!"
    ],
    commandPanel: "🔗 **Pannello:**",
    commandButton: "🎁 Riscuoti il Daily dal pannello",
    reminderTitle: "🌸 Ricompensa giornaliera disponibile! ・🔥 Serie: {streak} giorni",
    reminderBody: "Il tuo regalo giornaliero di Kizunas ti aspetta! Riscuotilo e scopri quante Kizunas Yukina ha preparato appositamente per oggi. 💜",
    reminderLink: "🔗 [Clicca qui per riscuotere la ricompensa giornaliera!](<{url}>)",
    reminderClosing: "**Non interrompere la tua serie!** Riscuoti le ricompense ogni giorno e mantieni viva la tua serie di successi. ✨",
    reminderSignature: "-# Yukina • Promemoria giornaliero Kizunas",
    imageDescription: "Immagine della ricompensa giornaliera di Yukina",
    reminderButton: "Riscuoti ricompensa"
  },
  "ko-KR": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ 눈은 조용히 내리지만, 새로운 하루는 새로운 기회를 가져와요. 매일 보상이 기다리고 있어요!",
      "🌙 달빛 아래에서는 작은 발걸음도 빛나요. 패널에 방문해 오늘의 데일리 보상을 받아보세요!",
      "✨ 새로운 페이지, 새로운 기회, 그리고 당신을 위한 보상. 데일리를 놓치지 마세요!",
      "🌸 바람에 흩날리는 벚꽃처럼 부드러운 하루가 되길 바라요. 매일 보상은 패널에서 받을 수 있어요!",
      "💎 당신의 여정에도 작은 선물이 필요하죠. Yukina 패널에서 데일리를 받아보세요!"
    ],
    commandPanel: "🔗 **패널:**",
    commandButton: "🎁 패널에서 데일리 받기",
    reminderTitle: "🌸 일일 보상을 받을 수 있어요! ・🔥 연속 기록: {streak}일",
    reminderBody: "매일의 키즈나 선물이 기다리고 있어요! 보상을 받고 Yukina가 오늘을 위해 준비한 키즈나를 확인해 보세요. 💜",
    reminderLink: "🔗 [여기를 눌러 일일 보상을 받으세요!](<{url}>)",
    reminderClosing: "**연속 기록을 끊지 마세요!** 매일 보상을 받고 소중한 기록을 이어가세요. ✨",
    reminderSignature: "-# Yukina • 키즈나 일일 알림",
    imageDescription: "Yukina 일일 보상 이미지",
    reminderButton: "보상 받기"
  },
  "zh-CN": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ 雪花缓缓落下，但每一天都带来新的机会。你的每日奖励正在等着你！",
      "🌙 月光之下，连小小的步伐也会闪耀。前往面板领取今天的 Daily 吧！",
      "✨ 新的一页、新的机会，还有一份为你准备的奖励。别错过 Daily！",
      "🌸 愿你的一天像随风飘舞的樱花一样轻柔。每日奖励可以在面板领取！",
      "💎 你的旅程也值得拥有小小的奖励。前往 Yukina 面板领取 Daily 吧！"
    ],
    commandPanel: "🔗 **面板：**",
    commandButton: "🎁 前往面板领取 Daily",
    reminderTitle: "🌸 每日奖励已开放！ ・🔥 连续签到：{streak}天",
    reminderBody: "你的每日 Kizunas 礼物正在等着你！快来领取，看看 Yukina 今天为你准备了多少 Kizunas 吧。💜",
    reminderLink: "🔗 [点击这里领取每日奖励！](<{url}>)",
    reminderClosing: "**不要让连续记录中断！** 每天领取奖励，保持你的连续签到记录。✨",
    reminderSignature: "-# Yukina • Kizunas 每日提醒",
    imageDescription: "Yukina 每日奖励图片",
    reminderButton: "领取奖励"
  },
  "zh-TW": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ 雪花緩緩落下，但每一天都帶來新的機會。你的每日獎勵正在等著你！",
      "🌙 月光之下，連小小的步伐也會閃耀。前往面板領取今天的 Daily 吧！",
      "✨ 新的一頁、新的機會，還有一份為你準備的獎勵。別錯過 Daily！",
      "🌸 願你的一天像隨風飄舞的櫻花一樣輕柔。每日獎勵可以在面板領取！",
      "💎 你的旅程也值得擁有小小的獎勵。前往 Yukina 面板領取 Daily 吧！"
    ],
    commandPanel: "🔗 **面板：**",
    commandButton: "🎁 前往面板領取 Daily",
    reminderTitle: "🌸 每日獎勵已開放！ ・🔥 連續簽到：{streak}天",
    reminderBody: "你的每日 Kizunas 禮物正在等著你！快來領取，看看 Yukina 今天為你準備了多少 Kizunas 吧。💜",
    reminderLink: "🔗 [點擊這裡領取每日獎勵！](<{url}>)",
    reminderClosing: "**不要讓連續紀錄中斷！** 每天領取獎勵，保持你的連續簽到紀錄。✨",
    reminderSignature: "-# Yukina • Kizunas 每日提醒",
    imageDescription: "Yukina 每日獎勵圖片",
    reminderButton: "領取獎勵"
  },
  "ru-RU": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Снег падает медленно, но каждый новый день приносит возможность. Твоя ежедневная награда уже ждёт!",
      "🌙 В лунном свете сияют даже маленькие шаги. Загляни на панель и забери сегодняшний Daily!",
      "✨ Новая страница, новый шанс и награда для тебя. Не пропусти свой Daily!",
      "🌸 Пусть твой день будет лёгким, как лепестки сакуры на ветру. Ежедневная награда ждёт на панели!",
      "💎 Твоё путешествие тоже заслуживает маленьких наград. Посети панель Yukina и забери Daily!"
    ],
    commandPanel: "🔗 **Панель:**",
    commandButton: "🎁 Забрать Daily на панели",
    reminderTitle: "🌸 Ежедневная награда доступна! ・🔥 Серия: {streak} дн.",
    reminderBody: "Твой ежедневный подарок Kizunas уже ждёт тебя! Забери его и узнай, сколько Kizunas Yukina приготовила специально на сегодня. 💜",
    reminderLink: "🔗 [Нажми здесь, чтобы получить ежедневную награду!](<{url}>)",
    reminderClosing: "**Не прерывай свою серию!** Забирай награды каждый день и сохраняй свою серию достижений. ✨",
    reminderSignature: "-# Yukina • Ежедневное напоминание Kizunas",
    imageDescription: "Изображение ежедневной награды Yukina",
    reminderButton: "Получить награду"
  },
  "ar-SA": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ يتساقط الثلج بهدوء، لكن كل يوم جديد يحمل فرصة. مكافأتك اليومية بانتظارك!",
      "🌙 تحت ضوء القمر، حتى الخطوات الصغيرة تتلألأ. زر اللوحة واستلم مكافأة Daily اليوم!",
      "✨ صفحة جديدة وفرصة جديدة ومكافأة من أجلك. لا تفوّت Daily!",
      "🌸 نتمنى أن يكون يومك رقيقًا كأزهار الساكورا في النسيم. مكافأتك اليومية متاحة في اللوحة!",
      "💎 رحلتك تستحق بعض المكافآت الصغيرة أيضًا. زر لوحة Yukina واستلم Daily!"
    ],
    commandPanel: "🔗 **اللوحة:**",
    commandButton: "🎁 استلام Daily من اللوحة",
    reminderTitle: "🌸 مكافأتك اليومية متاحة! ・🔥 السلسلة: {streak} يومًا",
    reminderBody: "هدية Kizunas اليومية بانتظارك! استلمها واكتشف عدد Kizunas التي أعدّتها Yukina لك خصيصًا اليوم. 💜",
    reminderLink: "🔗 [اضغط هنا لاستلام مكافأتك اليومية!](<{url}>)",
    reminderClosing: "**لا تدع سلسلتك تنقطع!** استلم مكافآتك كل يوم وحافظ على سلسلة إنجازاتك. ✨",
    reminderSignature: "-# Yukina • تذكير Kizunas اليومي",
    imageDescription: "صورة مكافأة Yukina اليومية",
    reminderButton: "استلام المكافأة"
  },
  "hi-IN": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ बर्फ़ धीरे-धीरे गिरती है, लेकिन हर नया दिन एक नया अवसर लाता है। आपका दैनिक इनाम आपका इंतज़ार कर रहा है!",
      "🌙 चाँदनी में छोटे कदम भी चमकते हैं। पैनल पर जाएँ और आज का Daily प्राप्त करें!",
      "✨ एक नया पन्ना, एक नया मौका और आपके लिए एक इनाम। अपना Daily न चूकें!",
      "🌸 आपका दिन हवा में झूमते सकुरा के फूलों जैसा हल्का हो। दैनिक इनाम पैनल पर आपका इंतज़ार कर रहा है!",
      "💎 आपकी यात्रा भी छोटे-छोटे इनाम की हकदार है। Yukina के पैनल पर जाएँ और Daily लें!"
    ],
    commandPanel: "🔗 **पैनल:**",
    commandButton: "🎁 पैनल से Daily लें",
    reminderTitle: "🌸 दैनिक इनाम उपलब्ध है! ・🔥 लगातार दिन: {streak}",
    reminderBody: "आपका रोज़ का Kizunas उपहार आपका इंतज़ार कर रहा है! इसे लें और देखें कि Yukina ने आज आपके लिए कितने Kizunas तैयार किए हैं। 💜",
    reminderLink: "🔗 [अपना दैनिक इनाम लेने के लिए यहाँ क्लिक करें!](<{url}>)",
    reminderClosing: "**अपनी लगातार चल रही श्रृंखला न टूटने दें!** हर दिन इनाम लें और अपनी उपलब्धियों का सिलसिला बनाए रखें। ✨",
    reminderSignature: "-# Yukina • दैनिक Kizunas रिमाइंडर",
    imageDescription: "Yukina के दैनिक इनाम की तस्वीर",
    reminderButton: "इनाम प्राप्त करें"
  },
  "bn-IN": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ তুষার ধীরে ধীরে ঝরে, কিন্তু প্রতিটি নতুন দিন নতুন সুযোগ নিয়ে আসে। আপনার দৈনিক পুরস্কার অপেক্ষা করছে!",
      "🌙 চাঁদের আলোয় ছোট পদক্ষেপও ঝলমল করে। প্যানেলে গিয়ে আজকের Daily সংগ্রহ করুন!",
      "✨ নতুন পৃষ্ঠা, নতুন সুযোগ, আর আপনার জন্য একটি পুরস্কার। Daily মিস করবেন না!",
      "🌸 বাতাসে ভেসে চলা সাকুরা ফুলের মতো আপনার দিনটি কোমল হোক। দৈনিক পুরস্কার প্যানেলে অপেক্ষা করছে!",
      "💎 আপনার যাত্রাও ছোট ছোট পুরস্কারের যোগ্য। Yukina-র প্যানেলে গিয়ে Daily সংগ্রহ করুন!"
    ],
    commandPanel: "🔗 **প্যানেল:**",
    commandButton: "🎁 প্যানেল থেকে Daily সংগ্রহ করুন",
    reminderTitle: "🌸 দৈনিক পুরস্কার পাওয়া যাচ্ছে! ・🔥 ধারাবাহিকতা: {streak} দিন",
    reminderBody: "আপনার প্রতিদিনের Kizunas উপহার অপেক্ষা করছে! সংগ্রহ করুন এবং দেখুন Yukina আজ আপনার জন্য কত Kizunas প্রস্তুত করেছে। 💜",
    reminderLink: "🔗 [দৈনিক পুরস্কার সংগ্রহ করতে এখানে ক্লিক করুন!](<{url}>)",
    reminderClosing: "**আপনার ধারাবাহিকতা ভেঙে যেতে দেবেন না!** প্রতিদিন পুরস্কার সংগ্রহ করুন এবং অর্জনের ধারাটি বজায় রাখুন। ✨",
    reminderSignature: "-# Yukina • দৈনিক Kizunas অনুস্মারক",
    imageDescription: "Yukina-র দৈনিক পুরস্কারের ছবি",
    reminderButton: "পুরস্কার সংগ্রহ করুন"
  },
  "nl-NL": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ De sneeuw valt zachtjes, maar elke nieuwe dag brengt een kans. Je dagelijkse beloning staat op je te wachten!",
      "🌙 In het maanlicht schitteren zelfs kleine stappen. Bezoek het paneel en haal je Daily van vandaag op!",
      "✨ Een nieuwe pagina, een nieuwe kans en een beloning voor jou. Mis je Daily niet!",
      "🌸 Moge je dag zo zacht zijn als sakura in de wind. Je dagelijkse beloning staat klaar op het paneel!",
      "💎 Ook jouw reis verdient kleine beloningen. Bezoek Yukina's paneel en haal je Daily op!"
    ],
    commandPanel: "🔗 **Paneel:**",
    commandButton: "🎁 Daily ophalen via het paneel",
    reminderTitle: "🌸 Dagelijkse beloning beschikbaar! ・🔥 Reeks: {streak} dagen",
    reminderBody: "Je dagelijkse Kizunas-cadeau staat op je te wachten! Haal het op en ontdek hoeveel Kizunas Yukina speciaal voor vandaag heeft klaargezet. 💜",
    reminderLink: "🔗 [Klik hier om je dagelijkse beloning op te halen!](<{url}>)",
    reminderClosing: "**Laat je reeks niet eindigen!** Haal elke dag je beloningen op en houd je reeks prestaties in stand. ✨",
    reminderSignature: "-# Yukina • Dagelijkse Kizunas-herinnering",
    imageDescription: "Afbeelding van Yukina's dagelijkse beloning",
    reminderButton: "Beloning ophalen"
  },
  "pl-PL": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Śnieg pada powoli, ale każdy nowy dzień przynosi szansę. Twoja codzienna nagroda już na Ciebie czeka!",
      "🌙 W blasku księżyca nawet małe kroki lśnią. Odwiedź panel i odbierz dzisiejsze Daily!",
      "✨ Nowa strona, nowa szansa i nagroda dla Ciebie. Nie przegap swojego Daily!",
      "🌸 Niech Twój dzień będzie lekki jak kwiaty sakury na wietrze. Codzienna nagroda czeka w panelu!",
      "💎 Twoja podróż również zasługuje na małe nagrody. Odwiedź panel Yukiny i odbierz Daily!"
    ],
    commandPanel: "🔗 **Panel:**",
    commandButton: "🎁 Odbierz Daily w panelu",
    reminderTitle: "🌸 Codzienna nagroda jest dostępna! ・🔥 Seria: {streak} dni",
    reminderBody: "Twój codzienny prezent Kizunas już na Ciebie czeka! Odbierz go i sprawdź, ile Kizunas Yukina przygotowała specjalnie na dziś. 💜",
    reminderLink: "🔗 [Kliknij tutaj, aby odebrać codzienną nagrodę!](<{url}>)",
    reminderClosing: "**Nie przerywaj swojej serii!** Odbieraj nagrody każdego dnia i utrzymuj swoją passę osiągnięć. ✨",
    reminderSignature: "-# Yukina • Codzienne przypomnienie Kizunas",
    imageDescription: "Obraz codziennej nagrody Yukiny",
    reminderButton: "Odbierz nagrodę"
  },
  "tr-TR": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Kar yavaşça yağar, ancak her yeni gün yeni bir fırsat getirir. Günlük ödülün seni bekliyor!",
      "🌙 Ay ışığında küçük adımlar bile parlar. Panele uğra ve bugünkü Daily ödülünü al!",
      "✨ Yeni bir sayfa, yeni bir şans ve sana özel bir ödül. Daily fırsatını kaçırma!",
      "🌸 Günün, rüzgârda süzülen sakura çiçekleri kadar hafif olsun. Günlük ödülün panelde seni bekliyor!",
      "💎 Yolculuğun da küçük ödülleri hak ediyor. Yukina panelini ziyaret et ve Daily ödülünü al!"
    ],
    commandPanel: "🔗 **Panel:**",
    commandButton: "🎁 Panelden Daily ödülünü al",
    reminderTitle: "🌸 Günlük ödül hazır! ・🔥 Seri: {streak} gün",
    reminderBody: "Günlük Kizunas hediyen seni bekliyor! Ödülünü al ve Yukina'nın bugün senin için özel olarak hazırladığı Kizunas miktarını keşfet. 💜",
    reminderLink: "🔗 [Günlük ödülünü almak için buraya tıkla!](<{url}>)",
    reminderClosing: "**Serinin bozulmasına izin verme!** Her gün ödüllerini al ve başarı serini sürdür. ✨",
    reminderSignature: "-# Yukina • Günlük Kizunas hatırlatması",
    imageDescription: "Yukina günlük ödül görseli",
    reminderButton: "Ödülü al"
  },
  "uk-UA": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Сніг тихо падає, але кожен новий день приносить можливість. Твоя щоденна нагорода вже чекає!",
      "🌙 У місячному сяйві навіть маленькі кроки блищать. Завітай на панель і забери сьогоднішній Daily!",
      "✨ Нова сторінка, новий шанс і нагорода для тебе. Не пропусти свій Daily!",
      "🌸 Нехай твій день буде легким, наче сакура на вітрі. Щоденна нагорода чекає на панелі!",
      "💎 Твоя подорож теж заслуговує на маленькі нагороди. Відвідай панель Yukina та забери Daily!"
    ],
    commandPanel: "🔗 **Панель:**",
    commandButton: "🎁 Забрати Daily на панелі",
    reminderTitle: "🌸 Щоденна нагорода доступна! ・🔥 Серія: {streak} днів",
    reminderBody: "Твій щоденний подарунок Kizunas уже чекає! Забери його та дізнайся, скільки Kizunas Yukina підготувала спеціально на сьогодні. 💜",
    reminderLink: "🔗 [Натисни тут, щоб отримати щоденну нагороду!](<{url}>)",
    reminderClosing: "**Не переривай свою серію!** Забирай нагороди щодня та підтримуй свою серію досягнень. ✨",
    reminderSignature: "-# Yukina • Щоденне нагадування Kizunas",
    imageDescription: "Зображення щоденної нагороди Yukina",
    reminderButton: "Отримати нагороду"
  },
  "vi-VN": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Tuyết rơi thật khẽ, nhưng mỗi ngày mới đều mang đến một cơ hội. Phần thưởng hằng ngày đang chờ bạn!",
      "🌙 Dưới ánh trăng, ngay cả những bước chân nhỏ cũng tỏa sáng. Hãy mở bảng và nhận Daily hôm nay!",
      "✨ Một trang mới, một cơ hội mới và phần thưởng dành riêng cho bạn. Đừng bỏ lỡ Daily nhé!",
      "🌸 Chúc ngày của bạn nhẹ nhàng như hoa sakura trong gió. Phần thưởng hằng ngày đang chờ trên bảng!",
      "💎 Hành trình của bạn cũng xứng đáng có những phần quà nhỏ. Hãy ghé bảng Yukina và nhận Daily!"
    ],
    commandPanel: "🔗 **Bảng điều khiển:**",
    commandButton: "🎁 Nhận Daily trên bảng",
    reminderTitle: "🌸 Đã có phần thưởng hằng ngày! ・🔥 Chuỗi: {streak} ngày",
    reminderBody: "Món quà Kizunas hằng ngày đang chờ bạn! Hãy nhận quà và khám phá số Kizunas mà Yukina đã chuẩn bị riêng cho hôm nay. 💜",
    reminderLink: "🔗 [Nhấn vào đây để nhận phần thưởng hằng ngày!](<{url}>)",
    reminderClosing: "**Đừng để chuỗi ngày bị gián đoạn!** Hãy nhận phần thưởng mỗi ngày và duy trì chuỗi thành tích của bạn. ✨",
    reminderSignature: "-# Yukina • Nhắc nhở Kizunas hằng ngày",
    imageDescription: "Hình ảnh phần thưởng hằng ngày của Yukina",
    reminderButton: "Nhận phần thưởng"
  },
  "th-TH": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ หิมะโปรยปรายอย่างช้า ๆ แต่วันใหม่ทุกวันนำโอกาสใหม่มาให้ รางวัลประจำวันกำลังรอคุณอยู่!",
      "🌙 ใต้แสงจันทร์ แม้แต่ก้าวเล็ก ๆ ก็เปล่งประกาย แวะไปที่แผงควบคุมเพื่อรับ Daily วันนี้!",
      "✨ หน้าใหม่ โอกาสใหม่ และรางวัลสำหรับคุณ อย่าพลาด Daily ของคุณนะ!",
      "🌸 ขอให้วันนี้อ่อนโยนเหมือนดอกซากุระที่พลิ้วไหวตามสายลม รางวัลประจำวันรออยู่บนแผงควบคุม!",
      "💎 การเดินทางของคุณก็สมควรได้รับรางวัลเล็ก ๆ เช่นกัน ไปที่แผงของ Yukina แล้วรับ Daily กันเลย!"
    ],
    commandPanel: "🔗 **แผงควบคุม:**",
    commandButton: "🎁 รับ Daily ที่แผงควบคุม",
    reminderTitle: "🌸 รับรางวัลประจำวันได้แล้ว! ・🔥 ต่อเนื่อง: {streak} วัน",
    reminderBody: "ของขวัญ Kizunas ประจำวันกำลังรอคุณอยู่! รับรางวัลแล้วดูว่า Yukina เตรียม Kizunas ไว้ให้คุณเท่าไรในวันนี้ 💜",
    reminderLink: "🔗 [คลิกที่นี่เพื่อรับรางวัลประจำวัน!](<{url}>)",
    reminderClosing: "**อย่าปล่อยให้สถิติขาดตอน!** รับรางวัลทุกวันเพื่อรักษาสถิติความสำเร็จของคุณ ✨",
    reminderSignature: "-# Yukina • แจ้งเตือน Kizunas ประจำวัน",
    imageDescription: "ภาพรางวัลประจำวันของ Yukina",
    reminderButton: "รับรางวัล"
  },
  "id-ID": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Salju turun perlahan, tetapi setiap hari baru membawa kesempatan. Hadiah harianmu sedang menunggu!",
      "🌙 Di bawah cahaya bulan, langkah kecil pun bersinar. Kunjungi panel dan klaim Daily hari ini!",
      "✨ Halaman baru, kesempatan baru, dan hadiah untukmu. Jangan lewatkan Daily-mu!",
      "🌸 Semoga harimu selembut bunga sakura yang tertiup angin. Hadiah harianmu menunggu di panel!",
      "💎 Perjalananmu juga pantas mendapatkan hadiah kecil. Kunjungi panel Yukina dan klaim Daily!"
    ],
    commandPanel: "🔗 **Panel:**",
    commandButton: "🎁 Klaim Daily di panel",
    reminderTitle: "🌸 Hadiah harian tersedia! ・🔥 Beruntun: {streak} hari",
    reminderBody: "Hadiah Kizunas harianmu sedang menunggu! Klaim dan cari tahu berapa banyak Kizunas yang disiapkan Yukina khusus untuk hari ini. 💜",
    reminderLink: "🔗 [Klik di sini untuk mengklaim hadiah harianmu!](<{url}>)",
    reminderClosing: "**Jangan biarkan rentetanmu terputus!** Klaim hadiah setiap hari dan pertahankan rentetan pencapaianmu. ✨",
    reminderSignature: "-# Yukina • Pengingat Kizunas harian",
    imageDescription: "Gambar hadiah harian Yukina",
    reminderButton: "Klaim hadiah"
  },
  "ms-MY": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Salji turun perlahan, namun setiap hari baharu membawa peluang. Ganjaran harian anda sedang menanti!",
      "🌙 Di bawah cahaya bulan, langkah kecil pun bersinar. Kunjungi panel dan tebus Daily hari ini!",
      "✨ Halaman baharu, peluang baharu dan ganjaran untuk anda. Jangan lepaskan Daily anda!",
      "🌸 Semoga hari anda selembut bunga sakura yang ditiup angin. Ganjaran harian menanti di panel!",
      "💎 Perjalanan anda juga layak menerima ganjaran kecil. Kunjungi panel Yukina dan tebus Daily!"
    ],
    commandPanel: "🔗 **Panel:**",
    commandButton: "🎁 Tebus Daily di panel",
    reminderTitle: "🌸 Ganjaran harian tersedia! ・🔥 Berturut-turut: {streak} hari",
    reminderBody: "Hadiah Kizunas harian anda sedang menanti! Tebus hadiah itu dan lihat jumlah Kizunas yang disediakan Yukina khas untuk hari ini. 💜",
    reminderLink: "🔗 [Klik di sini untuk menebus ganjaran harian anda!](<{url}>)",
    reminderClosing: "**Jangan biarkan rekod anda terputus!** Tebus ganjaran setiap hari dan kekalkan rentetan pencapaian anda. ✨",
    reminderSignature: "-# Yukina • Peringatan Kizunas harian",
    imageDescription: "Imej ganjaran harian Yukina",
    reminderButton: "Tebus ganjaran"
  },
  "sv-SE": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Snön faller stilla, men varje ny dag ger en ny möjlighet. Din dagliga belöning väntar på dig!",
      "🌙 I månljuset glittrar även små steg. Besök panelen och hämta dagens Daily!",
      "✨ En ny sida, en ny chans och en belöning till dig. Missa inte din Daily!",
      "🌸 Må din dag vara lika mjuk som sakura i vinden. Din dagliga belöning väntar på panelen!",
      "💎 Även din resa förtjänar små belöningar. Besök Yukinas panel och hämta din Daily!"
    ],
    commandPanel: "🔗 **Panel:**",
    commandButton: "🎁 Hämta Daily på panelen",
    reminderTitle: "🌸 Daglig belöning tillgänglig! ・🔥 Svit: {streak} dagar",
    reminderBody: "Din dagliga Kizunas-present väntar på dig! Hämta den och upptäck hur många Kizunas Yukina har förberett särskilt för idag. 💜",
    reminderLink: "🔗 [Klicka här för att hämta din dagliga belöning!](<{url}>)",
    reminderClosing: "**Låt inte din svit ta slut!** Hämta dina belöningar varje dag och behåll din svit av framsteg. ✨",
    reminderSignature: "-# Yukina • Daglig Kizunas-påminnelse",
    imageDescription: "Bild av Yukinas dagliga belöning",
    reminderButton: "Hämta belöning"
  },
  "da-DK": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Sneen falder stille, men hver ny dag bringer en mulighed. Din daglige belønning venter på dig!",
      "🌙 I månelyset skinner selv de små skridt. Besøg panelet, og hent dagens Daily!",
      "✨ En ny side, en ny chance og en belønning til dig. Gå ikke glip af din Daily!",
      "🌸 Må din dag være let som sakura i vinden. Din daglige belønning venter på panelet!",
      "💎 Din rejse fortjener også små belønninger. Besøg Yukinas panel, og hent din Daily!"
    ],
    commandPanel: "🔗 **Panel:**",
    commandButton: "🎁 Hent Daily på panelet",
    reminderTitle: "🌸 Daglig belønning er klar! ・🔥 Række: {streak} dage",
    reminderBody: "Din daglige Kizunas-gave venter på dig! Hent den, og se hvor mange Kizunas Yukina har gjort klar til dig i dag. 💜",
    reminderLink: "🔗 [Klik her for at hente din daglige belønning!](<{url}>)",
    reminderClosing: "**Lad ikke din række stoppe!** Hent dine belønninger hver dag, og hold din række af præstationer i gang. ✨",
    reminderSignature: "-# Yukina • Daglig Kizunas-påmindelse",
    imageDescription: "Billede af Yukinas daglige belønning",
    reminderButton: "Hent belønning"
  },
  "fi-FI": {
    commandTitle: "❄️ **Yukina Daily**",
    commandPhrases: [
      "❄️ Lumi sataa hiljaa, mutta jokainen uusi päivä tuo uuden mahdollisuuden. Päivittäinen palkintosi odottaa!",
      "🌙 Kuunvalossa pienetkin askeleet loistavat. Vieraile paneelissa ja lunasta tämän päivän Daily!",
      "✨ Uusi sivu, uusi mahdollisuus ja palkinto juuri sinulle. Älä unohda Dailyasi!",
      "🌸 Olkoon päiväsi yhtä lempeä kuin tuulessa leijailevat sakurat. Päivittäinen palkintosi odottaa paneelissa!",
      "💎 Myös matkasi ansaitsee pieniä palkintoja. Vieraile Yukinan paneelissa ja lunasta Daily!"
    ],
    commandPanel: "🔗 **Paneeli:**",
    commandButton: "🎁 Lunasta Daily paneelissa",
    reminderTitle: "🌸 Päivittäinen palkinto saatavilla! ・🔥 Putki: {streak} päivää",
    reminderBody: "Päivittäinen Kizunas-lahjasi odottaa sinua! Lunasta se ja katso, kuinka monta Kizunasta Yukina on valmistanut juuri tälle päivälle. 💜",
    reminderLink: "🔗 [Klikkaa tästä lunastaaksesi päivittäisen palkintosi!](<{url}>)",
    reminderClosing: "**Älä anna putkesi katketa!** Lunasta palkintosi joka päivä ja pidä saavutustesi putki yllä. ✨",
    reminderSignature: "-# Yukina • Päivittäinen Kizunas-muistutus",
    imageDescription: "Kuva Yukinan päivittäisestä palkinnosta",
    reminderButton: "Lunasta palkinto"
  }
});

function getDailyMessages(language) {
  return CATALOG[language] || CATALOG["pt-BR"];
}

function formatDailyText(template, variables = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : ""
  );
}

module.exports = { CATALOG, getDailyMessages, formatDailyText };
