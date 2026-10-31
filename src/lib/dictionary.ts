// ============================================================
// Sprout English — 本地离线词典（选中查词用）
// 数据来源：历届课程生词库 + 常用词基础词表（离线、零成本、无需联网）。
// 未收录的词仍可点 🔊 发音（speechSynthesis），只是不显示释义/音标。
// 后续可按需扩充 DICT；lookup() 已做简单词形还原（去 s/es/ed/ing）。
// ============================================================

export interface DictEntry {
  ph: string // 国际音标（美式）
  cn: string // 中文释义
}

// 课程生词 + 常用词（key 统一小写）
export const DICT: Record<string, DictEntry> = {
  // —— 本单元（Sounds in the Park）生词 ——
  tweet: { ph: 'twiːt', cn: '（鸟）啾啾叫' },
  buzz: { ph: 'bʌz', cn: '（蜜蜂）嗡嗡' },
  bang: { ph: 'bæŋ', cn: '（重击）砰' },
  woof: { ph: 'wʊf', cn: '（狗）汪汪' },
  flower: { ph: 'ˈflaʊər', cn: '花' },
  bee: { ph: 'biː', cn: '蜜蜂' },
  bird: { ph: 'bɜːrd', cn: '鸟' },
  tree: { ph: 'triː', cn: '树' },
  man: { ph: 'mæn', cn: '男人' },
  dog: { ph: 'dɔːɡ', cn: '狗' },
  hammer: { ph: 'ˈhæmər', cn: '锤子' },
  fence: { ph: 'fens', cn: '栅栏' },
  park: { ph: 'pɑːrk', cn: '公园' },
  city: { ph: 'ˈsɪti', cn: '城市' },
  buildings: { ph: 'ˈbɪldɪŋz', cn: '建筑物（building 复数）' },
  building: { ph: 'ˈbɪldɪŋ', cn: '建筑物' },
  grass: { ph: 'ɡræs', cn: '草' },
  nectar: { ph: 'ˈnektər', cn: '花蜜' },
  honey: { ph: 'ˈhʌni', cn: '蜂蜜' },
  sings: { ph: 'sɪŋz', cn: '唱歌（sing 三单）' },
  sing: { ph: 'sɪŋ', cn: '唱歌' },
  buzzes: { ph: 'ˈbʌzɪz', cn: '嗡嗡（buzz 三单）' },
  barks: { ph: 'bɑːrks', cn: '吠（bark 三单）' },
  bark: { ph: 'bɑːrk', cn: '（狗）吠；树皮' },
  makes: { ph: 'meɪks', cn: '制造（make 三单）' },
  make: { ph: 'meɪk', cn: '制造；做' },
  drinks: { ph: 'drɪŋks', cn: '喝（drink 三单）' },
  drink: { ph: 'drɪŋk', cn: '喝；饮料' },
  went: { ph: 'went', cn: '去（go 过去式）' },
  go: { ph: 'ɡoʊ', cn: '去' },
  bought: { ph: 'bɔːt', cn: '买（buy 过去式）' },
  buy: { ph: 'baɪ', cn: '买' },
  had: { ph: 'hæd', cn: '有（have 过去式）' },
  have: { ph: 'hæv', cn: '有' },
  glass: { ph: 'ɡlæs', cn: '玻璃杯；玻璃' },
  'water bowl': { ph: 'ˈwɔːtər boʊl', cn: '水碗' },
  water: { ph: 'ˈwɔːtər', cn: '水' },
  bowl: { ph: 'boʊl', cn: '碗' },
  pollen: { ph: 'ˈpɑːlən', cn: '花粉' },
  nest: { ph: 'nest', cn: '鸟巢' },
  eggs: { ph: 'eɡz', cn: '蛋（egg 复数）' },
  egg: { ph: 'eɡ', cn: '蛋' },
  worm: { ph: 'wɜːrm', cn: '蠕虫' },
  butterfly: { ph: 'ˈbʌtərflaɪ', cn: '蝴蝶' },
  drew: { ph: 'druː', cn: '画（draw 过去式）' },
  draw: { ph: 'drɔː', cn: '画；拉' },
  wrote: { ph: 'roʊt', cn: '写（write 过去式）' },
  write: { ph: 'raɪt', cn: '写' },
  jumped: { ph: 'dʒʌmpt', cn: '跳（jump 过去式）' },
  jump: { ph: 'dʒʌmp', cn: '跳' },
  ran: { ph: 'ræn', cn: '跑（run 过去式）' },
  run: { ph: 'rʌn', cn: '跑' },
  uses: { ph: 'ˈjuːzɪz', cn: '使用（use 三单）' },
  use: { ph: 'juːz', cn: '使用' },
  lays: { ph: 'leɪz', cn: '下（蛋）（lay 三单）' },
  lay: { ph: 'leɪ', cn: '放；下（蛋）' },
  cute: { ph: 'kjuːt', cn: '可爱的' },
  sweet: { ph: 'swiːt', cn: '甜的' },

  // —— 常用基础词（覆盖孩子日常阅读/对话）——
  // 代词 / be 动词
  i: { ph: 'aɪ', cn: '我' },
  you: { ph: 'juː', cn: '你；你们' },
  he: { ph: 'hiː', cn: '他' },
  she: { ph: 'ʃiː', cn: '她' },
  we: { ph: 'wiː', cn: '我们' },
  they: { ph: 'ðeɪ', cn: '他们' },
  it: { ph: 'ɪt', cn: '它' },
  am: { ph: 'æm', cn: '（我）是' },
  is: { ph: 'ɪz', cn: '（他/她/它）是' },
  are: { ph: 'ɑːr', cn: '（你/我们/他们）是' },
  be: { ph: 'biː', cn: '是（动词原形）' },
  my: { ph: 'maɪ', cn: '我的' },
  your: { ph: 'jɔːr', cn: '你的' },
  his: { ph: 'hɪz', cn: '他的' },
  her: { ph: 'hɜːr', cn: '她的' },
  our: { ph: 'ˈaʊər', cn: '我们的' },
  this: { ph: 'ðɪs', cn: '这个' },
  that: { ph: 'ðæt', cn: '那个' },
  the: { ph: 'ðə', cn: '（定冠词）' },
  a: { ph: 'ə', cn: '一个' },
  an: { ph: 'æn', cn: '一个（元音前）' },

  // 数字
  one: { ph: 'wʌn', cn: '一' },
  two: { ph: 'tuː', cn: '二' },
  three: { ph: 'θriː', cn: '三' },
  four: { ph: 'fɔːr', cn: '四' },
  five: { ph: 'faɪv', cn: '五' },
  six: { ph: 'sɪks', cn: '六' },
  seven: { ph: 'ˈsevn', cn: '七' },
  eight: { ph: 'eɪt', cn: '八' },
  nine: { ph: 'naɪn', cn: '九' },
  ten: { ph: 'ten', cn: '十' },

  // 颜色
  red: { ph: 'red', cn: '红色' },
  blue: { ph: 'bluː', cn: '蓝色' },
  green: { ph: 'ɡriːn', cn: '绿色' },
  yellow: { ph: 'ˈjeloʊ', cn: '黄色' },
  black: { ph: 'blæk', cn: '黑色' },
  white: { ph: 'waɪt', cn: '白色' },
  pink: { ph: 'pɪŋk', cn: '粉色' },
  orange: { ph: 'ˈɔːrɪndʒ', cn: '橙色；橘子' },
  purple: { ph: 'ˈpɜːrpl', cn: '紫色' },

  // 动物
  cat: { ph: 'kæt', cn: '猫' },
  cow: { ph: 'kaʊ', cn: '奶牛' },
  pig: { ph: 'pɪɡ', cn: '猪' },
  duck: { ph: 'dʌk', cn: '鸭子' },
  fish: { ph: 'fɪʃ', cn: '鱼' },
  horse: { ph: 'hɔːrs', cn: '马' },
  rabbit: { ph: 'ˈræbɪt', cn: '兔子' },
  mouse: { ph: 'maʊs', cn: '老鼠' },
  lion: { ph: 'ˈlaɪən', cn: '狮子' },
  tiger: { ph: 'ˈtaɪɡər', cn: '老虎' },
  bear: { ph: 'ber', cn: '熊' },
  panda: { ph: 'ˈpændə', cn: '熊猫' },
  monkey: { ph: 'ˈmʌŋki', cn: '猴子' },
  elephant: { ph: 'ˈelɪfənt', cn: '大象' },
  frog: { ph: 'frɔːɡ', cn: '青蛙' },

  // 家庭 / 人
  mom: { ph: 'mɑːm', cn: '妈妈' },
  dad: { ph: 'dæd', cn: '爸爸' },
  mother: { ph: 'ˈmʌðər', cn: '妈妈' },
  father: { ph: 'ˈfɑːðər', cn: '爸爸' },
  sister: { ph: 'ˈsɪstər', cn: '姐妹' },
  brother: { ph: 'ˈbrʌðər', cn: '兄弟' },
  baby: { ph: 'ˈbeɪbi', cn: '婴儿' },
  friend: { ph: 'frend', cn: '朋友' },
  teacher: { ph: 'ˈtiːtʃər', cn: '老师' },
  student: { ph: 'ˈstuːdnt', cn: '学生' },
  girl: { ph: 'ɡɜːrl', cn: '女孩' },
  boy: { ph: 'bɔɪ', cn: '男孩' },

  // 食物
  apple: { ph: 'ˈæpl', cn: '苹果' },
  banana: { ph: 'bəˈnænə', cn: '香蕉' },
  bread: { ph: 'bred', cn: '面包' },
  rice: { ph: 'raɪs', cn: '米饭' },
  milk: { ph: 'mɪlk', cn: '牛奶' },
  juice: { ph: 'dʒuːs', cn: '果汁' },
  cake: { ph: 'keɪk', cn: '蛋糕' },
  meat: { ph: 'miːt', cn: '肉' },

  // 身体
  head: { ph: 'hed', cn: '头' },
  eye: { ph: 'aɪ', cn: '眼睛' },
  ear: { ph: 'ɪr', cn: '耳朵' },
  nose: { ph: 'noʊz', cn: '鼻子' },
  mouth: { ph: 'maʊθ', cn: '嘴' },
  hand: { ph: 'hænd', cn: '手' },
  foot: { ph: 'fʊt', cn: '脚' },
  leg: { ph: 'leɡ', cn: '腿' },
  arm: { ph: 'ɑːrm', cn: '手臂' },

  // 学校 / 物品
  book: { ph: 'bʊk', cn: '书' },
  pen: { ph: 'pen', cn: '钢笔' },
  pencil: { ph: 'ˈpensl', cn: '铅笔' },
  school: { ph: 'skuːl', cn: '学校' },
  bag: { ph: 'bæɡ', cn: '包' },
  ball: { ph: 'bɔːl', cn: '球' },
  toy: { ph: 'tɔɪ', cn: '玩具' },
  car: { ph: 'kɑːr', cn: '汽车' },
  bus: { ph: 'bʌs', cn: '公交车' },

  // 常用动词
  eat: { ph: 'iːt', cn: '吃' },
  play: { ph: 'pleɪ', cn: '玩' },
  like: { ph: 'laɪk', cn: '喜欢' },
  see: { ph: 'siː', cn: '看见' },
  look: { ph: 'lʊk', cn: '看' },
  hear: { ph: 'hɪr', cn: '听见' },
  read: { ph: 'riːd', cn: '读' },
  speak: { ph: 'spiːk', cn: '说' },
  listen: { ph: 'ˈlɪsn', cn: '听' },
  walk: { ph: 'wɔːk', cn: '走' },
  sleep: { ph: 'sliːp', cn: '睡觉' },
  open: { ph: 'ˈoʊpən', cn: '打开' },
  close: { ph: 'kloʊz', cn: '关闭' },
  help: { ph: 'help', cn: '帮助' },
  learn: { ph: 'lɜːrn', cn: '学习' },
  love: { ph: 'lʌv', cn: '爱' },
  want: { ph: 'wɑːnt', cn: '想要' },
  come: { ph: 'kʌm', cn: '来' },
  find: { ph: 'faɪnd', cn: '找到' },
  give: { ph: 'ɡɪv', cn: '给' },

  // 形容词
  big: { ph: 'bɪɡ', cn: '大的' },
  small: { ph: 'smɔːl', cn: '小的' },
  happy: { ph: 'ˈhæpi', cn: '开心的' },
  sad: { ph: 'sæd', cn: '伤心的' },
  good: { ph: 'ɡʊd', cn: '好的' },
  bad: { ph: 'bæd', cn: '坏的' },
  new: { ph: 'njuː', cn: '新的' },
  old: { ph: 'oʊld', cn: '老的；旧的' },
  hot: { ph: 'hɑːt', cn: '热的' },
  cold: { ph: 'koʊld', cn: '冷的' },
  fast: { ph: 'fæst', cn: '快的' },
  slow: { ph: 'sloʊ', cn: '慢的' },
  little: { ph: 'ˈlɪtl', cn: '小的；一点' },

  // 方位 / 疑问
  in: { ph: 'ɪn', cn: '在…里' },
  on: { ph: 'ɑːn', cn: '在…上' },
  under: { ph: 'ˈʌndər', cn: '在…下面' },
  where: { ph: 'wer', cn: '在哪里' },
  what: { ph: 'wɑːt', cn: '什么' },
  who: { ph: 'huː', cn: '谁' },
  how: { ph: 'haʊ', cn: '怎样' },
  why: { ph: 'waɪ', cn: '为什么' },
  and: { ph: 'ænd', cn: '和' },
  but: { ph: 'bʌt', cn: '但是' },
  not: { ph: 'nɑːt', cn: '不' },
  can: { ph: 'kæn', cn: '能' },
  do: { ph: 'duː', cn: '做（助动词）' },
  does: { ph: 'dʌz', cn: '（三单）做' },
  to: { ph: 'tuː', cn: '到；向' },
}

// 简单词形还原候选（用于未直接命中的单词）
const SUFFIX_TRIES: Array<(w: string) => string | null> = [
  (w) => (w.endsWith('es') ? w.slice(0, -2) : null),
  (w) => (w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : null),
  (w) => (w.endsWith('ing') ? w.slice(0, -3) : null),
  (w) => (w.endsWith('ed') ? w.slice(0, -2) : null),
  (w) => (w.endsWith('ly') ? w.slice(0, -2) : null),
]

export interface LookupResult {
  word: string // 归一化后的查询词（小写、去标点）
  raw: string // 用户选中的原始文本
  entry?: DictEntry // 命中则存在
  isPhrase: boolean // 是否为词组/句子（含空格）
}

/**
 * 查词。支持单字与短语：
 * - 单字：先精确匹配，未命中则尝试去 s/es/ed/ing/ly 还原。
 * - 短语：返回 isPhrase=true，不查词典（用于整句跟读发音）。
 */
export function lookup(raw: string): LookupResult {
  const cleaned = raw.replace(/[“”‘’''".,!?;:()]/g, '').replace(/\s+/g, ' ').trim()
  const isPhrase = cleaned.includes(' ')
  const word = cleaned.toLowerCase()
  let entry = DICT[word]
  if (!entry && !isPhrase) {
    for (const tryFn of SUFFIX_TRIES) {
      const base = tryFn(word)
      if (base && DICT[base]) {
        entry = DICT[base]
        break
      }
    }
  }
  return { word, raw: cleaned, entry, isPhrase }
}
