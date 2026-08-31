import type { GrammarPoint } from '../types'

export const QUESTION_BANK: GrammarPoint[] = [
  {
    point: "复数主语+实义动词（不用be动词）",
    keywords: ["children is", "复数主语", "be动词", "is a jump", "is a run"],
    level: "高频错误",
    questions: [
      { type:"choice", q:"选正确的句子", options:["Children jump in the park","Children is a jump","Children are jump","Children jumping"], answer:0, explain:"复数主语（Children）直接+动词，不需要 be 动词。" },
      { type:"choice", q:"选正确的句子", options:["They run fast","They are run","They is run","They running"], answer:0, explain:"They 是复数，直接+动词 run，不需要 be 动词。" },
      { type:"fill", q:"填入正确形式：Children ___ (play) in the park.", answer:"play", accept:["plays"], explain:"Children 是复数主语，动词用原形 play，不加 -s。" },
      { type:"choice", q:"'孩子们在跑'，哪句对？", options:["The children run","The children is a run","The children are run","The children is run"], answer:0, explain:"复数主语 the children + 动词原形 run。" },
      { type:"fill", q:"填入正确形式：We ___ (draw) flowers.", answer:"draw", explain:"We 是复数，动词用原形 draw。" },
      { type:"choice", q:"哪个句子错了？", options:["The kids jump","The kids are jump","The kids play","The kids run"], answer:1, explain:"'The kids are jump' 错了——复数主语直接+动词即可。" }
    ]
  },
  {
    point: "There is / There are（存在句）",
    keywords: ["there is", "there are", "存在句"],
    level: "高频错误",
    questions: [
      { type:"choice", q:"___ a book on the desk.", options:["There is","There are","There be","There"], answer:0, explain:"单数 a book 用 There is。" },
      { type:"choice", q:"___ two cats in the box.", options:["There is","There are","There has","There have"], answer:1, explain:"复数 two cats 用 There are。" },
      { type:"fill", q:"填 is 或 are：There ___ a girl in the park.", answer:"is", explain:"a girl 是单数，用 There is。" },
      { type:"fill", q:"填 is 或 are：There ___ many toys on the floor.", answer:"are", explain:"many toys 是复数，用 There are。" },
      { type:"choice", q:"哪个对？", options:["There is a scooter","There are a scooter","There has a scooter"], answer:0, explain:"a scooter 单数，用 There is。" },
      { type:"choice", q:"哪个对？", options:["There are three children","There is three children","There be three children"], answer:0, explain:"three children 复数，用 There are。" }
    ]
  },
  {
    point: "第三人称单数 -s（he/she/it + 动词加s）",
    keywords: ["第三人称", "doesn't", "三单", "he bakes", "holds", "reads", "listens"],
    level: "高频错误",
    questions: [
      { type:"fill", q:"填入正确形式：He ___ (bake) bread.", answer:"bakes", explain:"He 三单，bake 加 -s → bakes。" },
      { type:"fill", q:"填入正确形式：She ___ (read) a book.", answer:"reads", explain:"She 三单，read 加 -s → reads。" },
      { type:"choice", q:"哪个对？", options:["He holds a pen","He hold a pen","He holding a pen"], answer:0, explain:"He 三单，动词加 -s：holds。" },
      { type:"choice", q:"She ___ to music.", options:["listens","listen","listening"], answer:0, explain:"She 三单，listen 加 -s。" },
      { type:"choice", q:"哪个对？", options:["The chicken reads a book","The chicken read a book","The chicken reading a book"], answer:0, explain:"The chicken 三单，动词加 -s：reads。" },
      { type:"fill", q:"填入正确形式：My mom ___ (make) cupcakes.", answer:"makes", explain:"My mom 三单，make → makes。" }
    ]
  },
  {
    point: "特殊疑问句（What/Where/When/How 提问）",
    keywords: ["what", "特殊疑问", "what did", "what do you", "when", "how"],
    level: "高频错误",
    questions: [
      { type:"choice", q:"'What did you do today?' 该怎么回答？", options:["I jumped at the park","At the park","Jump","I am jump"], answer:0, explain:"What did you do 问今天做了什么，要用过去时完整句回答。" },
      { type:"choice", q:"'What do you see?' 应该怎么回答？", options:["I see a bird","A bird","See","I seeing a bird"], answer:0, explain:"完整回答：I see a bird（主语+动词+宾语）。" },
      { type:"choice", q:"'What do you like to do for fun?' 是问什么？", options:["你喜欢做什么玩","你看到了什么","你在哪里玩","你几岁了"], answer:0, explain:"like to do for fun = 喜欢做什么来玩。" },
      { type:"choice", q:"'How do you play that game?' 是问什么？", options:["这个游戏怎么玩","这个游戏叫什么","这个游戏在哪","你喜欢这个游戏吗"], answer:0, explain:"How = 怎样。" },
      { type:"choice", q:"听到不懂的长问句，最好的做法是？", options:["说 Pardon? 请老师再说一遍","说 What? 然后沉默","随便猜一个答案","不回答"], answer:0, explain:"没听清时说 Pardon? 比 What? 更礼貌。" },
      { type:"choice", q:"'When does your school start?' 是问什么？", options:["学校几点开始","学校在哪里","学校有什么","学校叫什么"], answer:0, explain:"When = 什么时候。" }
    ]
  },
  {
    point: "read / write / ride / draw 辨析",
    keywords: ["read", "write", "ride", "draw", "混淆"],
    level: "高频错误",
    questions: [
      { type:"choice", q:"看书，用哪个动词？", options:["read","write","ride","draw"], answer:0, explain:"read a book = 看书。" },
      { type:"choice", q:"写字，用哪个动词？", options:["write","read","ride","draw"], answer:0, explain:"write = 写。" },
      { type:"choice", q:"骑自行车 ride a bike，ride 是什么意思？", options:["骑","读","写","画"], answer:0, explain:"ride = 骑（ride a bike/scooter）。" },
      { type:"choice", q:"画画，用哪个动词？", options:["draw","write","read","ride"], answer:0, explain:"draw = 画。" },
      { type:"fill", q:"填入 read/write/ride/draw：I ___ a book every day.", answer:"read", explain:"看书用 read。" },
      { type:"fill", q:"填入 read/write/ride/draw：I like to ___ a bike in the park.", answer:"ride", explain:"骑自行车用 ride。" }
    ]
  },
  {
    point: "冠词 a / an（辅音开头用a，元音开头用an）",
    keywords: ["冠词", "a/an", "冠词遗漏", "an orange", "a orange", "不可数名词加 a"],
    level: "巩固",
    questions: [
      { type:"choice", q:"___ apple", options:["an","a","the","/"], answer:0, explain:"apple 元音开头，用 an。" },
      { type:"choice", q:"___ book", options:["a","an","the","/"], answer:0, explain:"book 辅音开头，用 a。" },
      { type:"choice", q:"___ egg", options:["an","a","the","/"], answer:0, explain:"egg 元音开头，用 an。" },
      { type:"choice", q:"哪个对？", options:["an orange","a orange","the orange is a"], answer:0, explain:"orange 元音开头，用 an。" },
      { type:"fill", q:"填 a 或 an：I have ___ pencil.", answer:"a", explain:"pencil 辅音开头，用 a。" },
      { type:"choice", q:"___ scooter", options:["a","an","the","/"], answer:0, explain:"scooter 辅音开头，用 a。" }
    ]
  },
  {
    point: "代词 we / they（我们/他们）",
    keywords: ["we", "they", "代词", "混淆"],
    level: "巩固",
    questions: [
      { type:"choice", q:"'我们'用哪个代词？", options:["we","they","you","he"], answer:0, explain:"we = 我们。" },
      { type:"choice", q:"'他们'用哪个代词？", options:["they","we","she","it"], answer:0, explain:"they = 他们。" },
      { type:"choice", q:"自己和弟弟一起跳，说'___ jumped together.'", options:["We","They","He","She"], answer:0, explain:"包括自己在内用 We。" },
      { type:"choice", q:"看到别的小孩在跑，说'___ are running.'", options:["They","We","He","She"], answer:0, explain:"指别人用 They。" },
      { type:"choice", q:"哪个对？", options:["We like to play","We likes to play","We is play","We playing"], answer:0, explain:"We + 动词原形 like。" }
    ]
  },
  {
    point: "一般过去时（动词加 -ed 或不规则变化）",
    keywords: ["过去时", "jumped", "ran", "went", "played", "drew", "did"],
    level: "巩固",
    questions: [
      { type:"fill", q:"填过去式：Yesterday I ___ (jump) at the park.", answer:"jumped", explain:"规则动词 jump +ed = jumped。" },
      { type:"fill", q:"填过去式：I ___ (run) fast.", answer:"ran", explain:"run 不规则，过去式 ran。" },
      { type:"fill", q:"填过去式：I ___ (go) to the park.", answer:"went", explain:"go 的过去式是 went。" },
      { type:"fill", q:"填过去式：I ___ (draw) flowers.", answer:"drew", explain:"draw 的过去式是 drew。" },
      { type:"choice", q:"'我昨天玩了'，哪句对？", options:["I played yesterday","I play yesterday","I playing yesterday","I am play yesterday"], answer:0, explain:"yesterday 表示过去，动词加 -ed：played。" },
      { type:"choice", q:"哪个是 'go' 的过去式？", options:["went","goed","going","go"], answer:0, explain:"go → went（不规则）。" }
    ]
  },
  {
    point: "否定句 don't / doesn't（三单用doesn't）",
    keywords: ["don't", "doesn't", "否定", "do not"],
    level: "巩固",
    questions: [
      { type:"choice", q:"I ___ like basketball.", options:["don't","doesn't","not","no"], answer:0, explain:"I 用 don't。" },
      { type:"choice", q:"She ___ like cars.", options:["doesn't","don't","not","no"], answer:0, explain:"She 三单，用 doesn't。" },
      { type:"fill", q:"填 don't 或 doesn't：I ___ have a box.", answer:"don't", explain:"I 用 don't。" },
      { type:"fill", q:"填 don't 或 doesn't：He ___ play with cars.", answer:"doesn't", explain:"He 三单用 doesn't。" },
      { type:"choice", q:"哪个对？", options:["She doesn't like cars","She don't like cars","She not like cars","She no like cars"], answer:0, explain:"She 三单，否定用 doesn't。" }
    ]
  },
  {
    point: "can / can't（能/不能）",
    keywords: ["can't", "cannot", "can"],
    level: "巩固",
    questions: [
      { type:"choice", q:"'我会骑自行车'，哪句对？", options:["I can ride a bike","I ride a bike can","I can ride a bike is","I am can ride"], answer:0, explain:"can + 动词原形：I can ride a bike。" },
      { type:"choice", q:"'他不会游泳'，哪句对？", options:["He can't swim","He don't swim","He not swim","He can't swims"], answer:0, explain:"can't 后接动词原形 swim。" },
      { type:"choice", q:"They can ___ a scooter.", options:["ride","rides","riding","rode"], answer:0, explain:"can 后接动词原形 ride。" },
      { type:"fill", q:"填 can 或 can't：A fish ___ swim.", answer:"can", explain:"鱼会游泳，用 can。" },
      { type:"choice", q:"哪个对？", options:["I cannot read","I not can read","I don't can read"], answer:0, explain:"否定用 cannot 或 can't。" }
    ]
  },
  {
    point: "like to + 动词原形（喜欢做某事）",
    keywords: ["like to", "like", "喜好"],
    level: "巩固",
    questions: [
      { type:"choice", q:"'我喜欢跑步'，哪句对？", options:["I like to run","I like to running","I like run","I likes to run"], answer:0, explain:"like to + 动词原形：like to run。" },
      { type:"choice", q:"She likes to ___ a bike.", options:["ride","rides","riding","rode"], answer:0, explain:"to 后接动词原形 ride。" },
      { type:"fill", q:"填入动词原形：I like to ___ (play) with my brother.", answer:"play", explain:"like to + 动词原形 play。" },
      { type:"choice", q:"哪个对？", options:["I like to run from the ghost","I like run from the ghost","I like to running from the ghost"], answer:0, explain:"like to + 动词原形 run。" }
    ]
  },
  {
    point: "What do you see? / What did you do?（提问与回答）",
    keywords: ["what do you see", "what did you do", "see", "回答困难"],
    level: "巩固",
    questions: [
      { type:"choice", q:"'What do you see?' 完整回答：", options:["I see a bird in the tree","A bird","See","Bird"], answer:0, explain:"完整句：I see + 物品 + 位置。" },
      { type:"choice", q:"'What did you do today?' 用什么时态回答？", options:["过去时","现在时","进行时","将来时"], answer:0, explain:"did 表示过去，回答用过去时。" },
      { type:"fill", q:"完整回答'What did you do?'：I ___ at the park. (jump的过去式)", answer:"jumped", explain:"用过去时 jumped。" },
      { type:"choice", q:"看到老师拿图问'What do you see?'，你应该？", options:["用完整句描述图里有什么","只说一个单词","说 I don't know","沉默"], answer:0, explain:"用 I see... 完整描述。" }
    ]
  }
]
