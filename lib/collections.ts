export type ArchiveCollection = {
  slug: string;
  title: string;
  description: string;
  readingNote: string;
  tone: "yellow" | "blue" | "pink" | "green";
  recordIds: readonly string[];
};

export const collectionPolicy =
  "专题按表达场景组织现有档案，同一档案可跨专题收录。事实与传播证据以各档案中的来源为准；专题顺序不表示热度排名。";

export const collections: readonly ArchiveCollection[] = [
  {
    slug: "sound-loops",
    title: "声音一响，就知道梗",
    description: "歌曲、口令和空耳片段被反复接唱、翻跳与改编。沿着熟悉的声音，看看同一段素材怎样长出不同版本。",
    readingNote: "对照各档案里的原始素材与代表二创，留意旋律、发音和动作分别怎样进入新的使用场景。",
    tone: "yellow",
    recordIds: [
      "ji-ni-taimei", "hachimi", "manbo", "konglong-kanglang",
      "kemu-san", "ai-ru-huo", "wa-ya-wa", "tingwo-shuo-xiexieni",
      "danhuang-changqun", "lai-cai", "meichuxi", "gouxiong-duosuomao",
      "shanshenbu", "wo-xing-shi", "zaoan-longhui", "woshi-yunnan",
    ],
  },
  {
    slug: "beyond-the-match",
    title: "对局之外，仍在玩梗",
    description: "从操作与运气到翻车和情绪升温，把玩家用语与日常表达并排看。这里既有游戏里的语境，也有走进生活的说法。",
    readingNote: "先看档案中的游戏场景，再读日常用法；同一个词在赞叹、自嘲和调侃里，可以有不同的语气。",
    tone: "blue",
    recordIds: [
      "pofangle", "laoliu", "yingkong", "hongwen",
      "babiq-le", "wuhu-qifei", "cai-jiu-duolian",
      "roudan-congji", "ouhuang-feiqiu", "lingzhen-qishou", "yingmale",
    ],
  },
  {
    slug: "working-life",
    title: "打工人的情绪备忘录",
    description: "学业期待、职场压力、模板化表达和暂停竞争的自嘲，被写成一组共同称呼。看看人们怎样给自己的日常起名字。",
    readingNote: "把称呼与具体处境一起读，既保留自嘲的轻巧，也留意档案里对现实压力和人物二创的区分。",
    tone: "green",
    recordIds: [
      "dagongren", "banwei", "niuma", "neijuan",
      "tangping", "bailan", "zheng-dun-zhichang", "xiaozhen-zuotijia",
      "kongyiji-wenxue", "45du-qingnian", "jingshen-neihao", "kefu-xiaoxiang",
      "wonangfei-saidao", "yuzhi-xx", "renjigan", "meichuxi",
    ],
  },
  {
    slug: "being-kind-to-yourself",
    title: "把自己接住",
    description: "用自嘲说出低落，用一句话回望难关，再把安慰和肯定留给自己。串起这些档案里的情绪表达与生活语境。",
    readingNote: "可以从表达低落的词读到肯定自己的话，比较不同语气怎样承载相似的生活感受。",
    tone: "pink",
    recordIds: [
      "lanshouxianggu", "emo", "shushu-wenxue", "ai-ni-laoji",
      "jing-ziji", "qingzhou-wanzhongshan", "songchigan", "na-zale",
      "ruhe-ne", "dianzi-buluofen", "saibo-gongde", "qingxu-jiazhi",
      "niantou-tongda", "huorengan",
    ],
  },
  {
    slug: "watching-together",
    title: "一起看的那一刻",
    description: "可爱时赞叹，重逢时怀旧，意外时打出一个问号。这些简短字句，把各自的感受变成同屏的共同回应。",
    readingNote: "留意字母、单字和短句各自的表达方式，再从平台记录与作品语境中理解这些共同回应。",
    tone: "yellow",
    recordIds: [
      "awsl", "yeqinghui", "xi", "youya",
      "a-question", "zhijing", "jie", "keai-nie",
      "gaia", "dunchu-hongchen", "tong-taitongle", "bengbu-zhule",
    ],
  },
  {
    slug: "scenes-in-new-contexts",
    title: "一个名场面，许多新语境",
    description: "表情、问答、动作和台词从原作中被挑出来，又被带进聊天与二创。把这些档案放在一起，看熟悉的名场面怎样换一个使用场景。",
    readingNote: "先找到原作里的表演和情节，再看它在聊天、配音与剪辑中的用法，保留原作与二创之间的区别。",
    tone: "blue",
    recordIds: [
      "zhenxiang", "woyao-yanpai", "ni-meishi-ba", "zhe-shi-keyi-shuo",
      "tui-tui-tui", "jiuzhuan-dachang", "jitang-lailuo", "haozi-weizhi",
      "a-se-qingzuo", "xiangzuo-biliang", "weishenme-chunriying", "buyao-tingxialai",
      "wode-yanjing-jiushi-chi", "beijing-tai-jia", "xiaoshuai-xiaomei", "tingquan-cat",
    ],
  },
];

export function getCollection(slug: string): ArchiveCollection | undefined {
  return collections.find((collection) => collection.slug === slug);
}
