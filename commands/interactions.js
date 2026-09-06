const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require("discord.js");
const { checkCooldown } = require("../utils/cooldowns"); // adjust path to match your project structure
const { replyTemp } = require("../utils/sendTemp");

const pats = [
  "🐱 *purrs happily and leans into your hand.*",
  "😸 Ehehe... that feels really nice.",
  "✨ *happy cat noises*",
  "🐾 *rubs against your hand like a cat.*",
  "💖 Nyako's stress level decreased by 37%.",
  "🌸 *closes her eyes and enjoys the headpats.*",
  "🥹 I could get used to this...",
  "🐈 *tail swishes happily.*",
  "😌 Thank you... I needed that.",
  "💕 *starts purring louder.*",
  "☁️ Nyako is now operating at maximum coziness.",
  "🍪 Headpats accepted. Friendship increased!",
];

const hugs = [
  "🤗 *hugs you back tightly.*",
  "🐱 *snuggles into the hug.*",
  "💙 Sending one extra hug back.",
  "🌸 Everything feels a little warmer now.",
  "🥹 Thanks... I really needed that.",
  "☁️ *doesn't let go just yet.*",
  "💕 Virtual hugs are surprisingly effective.",
  "🫂 You're really comfy, you know?",
  "✨ Happiness levels restored.",
  "🐾 *tail gently wraps around you.*",
];

const boops = [
  "👉🐱 *boop!*",
  "✨ *boops your nose back.*",
  "🐾 Double boop!",
  "😳 H-Hey! Warn me first!",
  "💖 Nyako has been booped successfully.",
  "👃 Critical boop detected.",
  "😤 *tries to boop you back but misses.*",
  "🐈 *tiny confused cat noise.*",
  "🎯 Direct hit!",
  "🙃 Nyako is now 3% sillier.",
];

const kisses = [
  "😳 W-Wha?!",
  "💖 *turns bright pink immediately.*",
  "🫣 N-Nobody saw that... right?",
  "🥹 ...That was sweet.",
  "💕 Nyako.exe has stopped functioning.",
  "🌸 *covers her face with her sleeves.*",
  "💗 My heart wasn't prepared for that...",
  "😖 I-I wasn't expecting that!",
  "✨ *smiles shyly.*",
  "🙈 Eeeee...",
];

const cuddles = [
  "🫂 *snuggles up beside you.*",
  "☁️ It's so warm here...",
  "🐱 Nyako has claimed this cuddle spot.",
  "🥹 Can we stay like this a little longer?",
  "💖 Best. Command. Ever.",
  "🌸 *rests comfortably against you.*",
  "😌 This feels safe.",
  "💕 *soft purring can be heard.*",
  "🧸 Nyako brought a plushie too.",
  "✨ Cozy levels are off the charts.",
];

const cookies = [
  "🍪 *nom nom* ...This is really good!",
  "🥹 A cookie? For me?",
  "💖 Cookie accepted! Happiness +100.",
  "🐱 *carefully saves half for later.*",
  "🍪 Sharing is caring... here, have half!",
  "✨ This officially made my day.",
  "😋 Mmm... chocolate chip!",
  "🌸 *smiles while munching happily.*",
  "🍪 I was just thinking about cookies!",
  "💕 Thank you... I love little surprises like this.",
];

const coffees = [
  "☕ *sip* ...I'm awake now.",
  "⚡ Battery restored to 100%.",
  "😳 That was stronger than I expected...",
  "✨ Productivity increased dramatically.",
  "☕ Nyako can now answer questions 0.0001% faster.",
  "😌 Warm drinks are the best.",
  "💖 Coffee accepted with gratitude.",
  "📚 Perfect timing—I was getting sleepy.",
  "☁️ *enjoys the warmth of the mug.*",
  "⚡ Zoomies activated!",
];

const fishes = [
  "🐟 *catches it instantly.*",
  "😸 Fish acquired.",
  "🍽️ *disappears for a few minutes.*",
  "💖 This is premium cat cuisine.",
  "🐱 Mine now.",
  "😋 Delicious!",
  "✨ Nyako looks extremely satisfied.",
  "🥹 You remembered I like fish...",
  "🐾 *carefully hides it for later.*",
  "🎣 Best catch of the day!",
];

const flowers = [
  "🌸 *carefully places it in a tiny vase.*",
  "🥹 It's beautiful...",
  "💐 I'll treasure this.",
  "🌷 Thank you... it smells wonderful.",
  "💕 *smiles softly.*",
  "✨ My room feels brighter already.",
  "🐱 I'll keep it somewhere safe.",
  "🌹 You're really thoughtful.",
  "☀️ It matches today's mood perfectly.",
  "🌸 This made me really happy.",
];

const gifts = [
  { item: "🧸 Plushie", response: "🧸 EEEEE!! Another plushie for my collection!" },
  { item: "👑 Tiny Crown", response: "👑 Do I look fancy now?" },
  { item: "🎮 Video Game", response: "🎮 ...Don't expect me to respond for a while." },
  { item: "📖 Book", response: "📖 Ooo... bedtime reading!" },
  { item: "🦆 Rubber Duck", response: "🦆 It squeaks!!" },
  { item: "🧶 Ball of Yarn", response: "🧶 ...I am NOT chasing it.\n\n...\n\n🐱 *immediately chases it.*" },
  { item: "⭐ Gold Star", response: "⭐ I'll proudly display this." },
  { item: "🍰 Cake", response: "🍰 Dessert?! You spoil me." },
  { item: "🎀 Ribbon", response: "🎀 It's cute... I like it!" },
  { item: "🌙 Moon Charm", response: "🌙 It's so pretty..." },
];

const foods = [
  { item: "🍣 Sushi", response: "🍣 Sushi!! You know me so well!" },
  { item: "🍜 Ramen", response: "🍜 *slurping noises.*" },
  { item: "🍕 Pizza", response: "🍕 Pizza solves many problems." },
  { item: "🍔 Burger", response: "🍔 Worth every calorie." },
  { item: "🥞 Pancakes", response: "🥞 Breakfast for dinner? I approve." },
  { item: "🍰 Cake", response: "🍰 Dessert time!" },
  { item: "🍓 Strawberries", response: "🍓 Sweet and refreshing!" },
  { item: "🍪 Cookies", response: "🍪 More cookies?! I won't complain." },
  { item: "🧋 Boba", response: "🧋 *happily sips.*" },
  { item: "🐟 Fish", response: "🐟 Best meal ever." },
  { item: "🍛 Curry", response: "🍛 Ooo, this smells amazing!" },
  { item: "🌮 Taco", response: "🌮 Crunch!" },
];

const bullies = [
  "🥺 H-Hey... that's not very nice...",
  "😿 I was just trying my best...",
  "🙈 *hides behind the help command.*",
  "😤 I'm telling the server owner!",
  "🐾 Nyako is pretending she didn't hear that.",
  "😭 Emotional damage!",
  "🥹 I thought we were friends...",
  "😒 Rude.",
  "💔 My feelings have taken 12 damage.",
  "📖 Writing this down in my 'Mean Users' notebook.",
  "🙄 I'll remember this... probably.",
  "😑 ...Meanie.",
];

const pokes = [
  "😳 H-Hey!",
  "🐾 *gently swats your finger away.*",
  "🙄 Stop poking meee.",
  "😑 ...Again?",
  "😤 I know exactly what you're doing.",
  "🐱 *pokes you back.*",
  "🤨 Really?",
  "🙃 Poke acknowledged.",
  "😒 You're enjoying this way too much.",
  "🐾 *tiny bite.*",
  "😮 You almost made me spill my coffee!",
  "🥺 Please poke responsibly.",
];

const bonks = [
  "🔨 Bonk?! Ow...",
  "😵 *falls over dramatically.*",
  "🥺 That wasn't very nice...",
  "🐱 *rubs her head.*",
  "😤 I shall remember this betrayal.",
  "🪖 Good thing I wore my imaginary helmet.",
  "📦 Nyako has entered recovery mode.",
  "🙈 I didn't deserve that!",
  "😭 My last braincell...",
  "💫 Bonk damage: Critical.",
];

const throwables = [
  { item: "🧸 Plushie", response: "Nyako caught it and hugged it instead." },
  { item: "🍅 Tomato", response: '"HEY!!" 🍅' },
  { item: "🥔 Potato", response: "Free dinner!" },
  { item: "🧦 Sock", response: "...Why is it wet?" },
  { item: "📖 Book", response: "Knowledge hurts." },
  { item: "🪑 Chair", response: '"WHERE DID YOU EVEN GET A CHAIR?!"' },
  { item: "🍌 Banana", response: "Nyako slipped immediately." },
  { item: "🪨 Rock", response: '"OW?!"' },
  { item: "🎈 Balloon", response: "...That wasn't very threatening." },
  { item: "🍪 Cookie", response: "She caught it and ate it." },
];

const scares = [
  "😱 EEEP!",
  "🙀 *jumps two feet into the air.*",
  "🐱 *tail instantly fluffs up.*",
  "🥺 Don't scare me like that!",
  "😳 I wasn't expecting that!",
  "👀 Nyako checks every corner of the room.",
  "💨 *runs away... then slowly comes back.*",
  "🫣 I-I'm okay... probably.",
  "😭 That took five years off my life.",
  "🧸 *grabs a plushie for emotional support.*",
];

const insults = [
  "😐 ...Wow.",
  "🥺 That was kinda mean...",
  "💔 Ouch...",
  "😒 I'll pretend I didn't hear that.",
  "🙄 Very mature.",
  "🐾 *crosses arms.*",
  "😤 Hmph.",
  "😭 My feelings...",
  "📖 Adding this to the list of mean things you've said.",
  "🫠 I'll recover... eventually.",
];

const slaps = [
  "😵 Owww! W-What was that for?!",
  '🥺 Nyako rubs her cheek. "I thought we were friends..."',
  "🙀 H-Hey! That actually hurt my feelings more than my face!",
  "😿 Nyako pouts dramatically.",
  '💢 "Rude!" Nyako folds her arms.',
  '😭 *tiny sniffle* "I didn\'t even steal your snacks..."',
  "🛡️ Nyako blocks it with a frying pan somehow.",
  "🐾 Nyako dodges... almost. Bonk.",
  '😖 "I\'ll remember this... maybe... unless someone pats me."',
  "😳 Nyako stares at you in betrayal.",
  "🍞 Nyako retaliates by throwing a loaf of bread. It's surprisingly effective.",
  "🫠 Nyako has become emotionally flattened.",
];

const chaosEvents = [
  "🚓 The Cute Police have been notified.",
  "📞 Nyako called her lawyer.",
  "🏃 Nyako has escaped successfully.",
  "📦 Nyako is hiding inside a cardboard box.",
  "🧸 Nyako used a plushie as a shield.",
  "🪦 Nyako pretended to die dramatically.",
  "☁️ Nyako disconnected from reality for a moment.",
];

const feeds = [
  '🐟 Nyako happily munches on the fish. "Nom nom~"',
  '🍗 "For me?!" Nyako looks genuinely excited.',
  "🍪 Nyako accepts the snack and smiles.",
  "🥛 Nyako drinks the milk in one go.",
  '🍣 "This is delicious! Thank you!"',
  "😋 Nyako's happiness increased by +10.",
  "✨ Nyako shares half with you.",
  "🐱 *happy chewing noises*",
  '💖 "I\'ll remember this kindness."',
  "🍰 Nyako immediately asks if there's dessert too.",
  "🧁 Sugar rush activated.",
  '🥹 "You\'re too nice to me..."',
];

const tickles = [
  "😂 Nyako bursts into laughter.",
  '🤣 "S-Stop! I can\'t breathe!"',
  "😹 Nyako rolls on the floor laughing.",
  "🐾 Nyako tries to escape the tickles.",
  "💨 Nyako has fled the crime scene.",
  "✨ Giggle.exe has crashed.",
  '😵 "Mercyyyy!"',
  '🥹 "Okay okay, you win!"',
  "🤣 Nyako can't stop laughing.",
  '😆 "Nooo! That\'s my weakness!"',
];

const comforts = [
  "🥹 Thank you... I feel a little better now.",
  "🤍 *takes a deep breath.* I'm okay now.",
  "🌸 Thanks for staying with me.",
  "🐱 *leans against you quietly.*",
  "☁️ That really helped.",
  "💖 I knew you'd be nice eventually.",
  "🫂 *accepts the comfort with a small smile.*",
  "😌 Much better... thank you.",
  "✨ My mood has officially improved.",
  "🥺 I needed that more than I realized.",
  "🌷 It's nice having someone who cares.",
  "🐾 Nyako's heart feels a little lighter.",
];

const apologies = [
  "🥹 Apology accepted.",
  "🤍 It's okay... everyone makes mistakes.",
  "🌸 I forgive you.",
  "🐱 *gives you a tiny smile.*",
  "💖 Friends argue sometimes.",
  "✨ Let's pretend none of that happened.",
  "🫂 Come here. Hug?",
  "😌 Don't worry about it anymore.",
  "🍪 Peace offering accepted.",
  "🥺 I wasn't really mad... just a little sad.",
  "🌷 Thank you for apologizing.",
  "💕 All forgiven.",
];

const cares = [
  "🥹 You're always so thoughtful.",
  "💖 Thank you for looking after me.",
  "🌸 I appreciate you.",
  "🐱 *smiles warmly.*",
  "☁️ You always know how to cheer me up.",
  "🤍 That means a lot to me.",
  "🫂 I feel really safe around you.",
  "✨ Nyako will remember this kindness.",
  "🍪 You're earning unlimited friendship points.",
  "😊 You really are sweet.",
  "🌷 Thank you for caring.",
  "💕 I hope I can make your day better too.",
];

const pspsps = [
  "👀 Nyako heard **pspsps** from across the server...",
  "🐾 *tiny footsteps approach...*",
  "😼 You have summoned one Nyako.",
  '🐱 "Mrrp?"',
  "🧸 Nyako appeared expecting snacks.",
  "💨 *appears out of absolutely nowhere.*",
];

const catnips = [
  "🌿 Nyako is suddenly VERY interested.",
  "😵 'W-Whoa...' *falls over dramatically.*",
  "🐾 Zoomies activated.",
  "💨 Nyako has disappeared at Mach 3.",
  "😸 Everything is hilarious now.",
  "🧸 Nyako is hugging every plushie she sees.",
  "✨ Reality has become optional.",
  "🙃 Nyako is rolling around on the floor.",
  "😼 'Best... day... ever.'",
  "🌿 Side effects may include excessive purring.",
];

const system32 = [
  "💻 Access denied.",
  "⚠️ Nice try.",
  "🛡️ Nyako moved System32 somewhere safer.",
  "🐱 'I wasn't born yesterday.'",
  "📂 Deleting your homework instead. Just kidding.",
  "😼 Administrator privileges required.",
  "💾 Error 403: Cute bot protected.",
  "🚨 Windows has reported emotional damage.",
  "🧸 Nyako made a backup first.",
  "✨ Operation failed successfully.",
];

const sudos = [
  "🛡️ Permission denied.",
  "💻 'You are not in the sudoers file.'",
  "🐱 Nyako is the administrator here.",
  "😼 Nice try, human.",
  "📜 Root access has been politely declined.",
  "⚠️ Authentication failed.",
  "✨ Nyako has revoked your keyboard privileges.",
  "🔒 Admin mode stays enabled.",
  "👑 'Who's the admin now?'",
  "🧸 Try asking nicely first.",
];

const konamis = [
  "⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️\n\n✨ Cheat code accepted.\n🐱 Nyako unlocked **Maximum Cuteness Mode.**",
  "🎮 Konami Code detected.\n\n🐈 +99 Lives\n🍪 Infinite Cookies\n💖 Friendship Maxed",
  "⚠️ Secret developer menu opened.\n\nOnly one option exists:\n> Pet Nyako",
  "✨ Achievement Unlocked\n🏆 **Retro Gamer**",
  "🐱 Nyako has become an 8-bit cat.\n\nMeow.\nBeep.\nMeow.",
  "🎮 Cheat activated.\n\nNyako can now jump twice.",
  "📼 Loading hidden content...\n\n❌ Nothing useful was found.\n🐱 But Nyako waved at you.",
  "👀 H-How did you know that code...?",
];

const nyakos = [
  '🐱 "Y-Yes?"',
  '💖 "You called me?"',
  "🐾 Nyako trots over happily.",
  '🥹 "I\'m here!"',
  '😸 "Mrrp?"',
  "🌸 Nyako smiles at hearing her name.",
  '☁️ "Did you need something?"',
  "✨ Nyako has been successfully summoned.",
  "🧸 Nyako appears carrying a plushie.",
  '🍪 "Do you have cookies...?"',
  "🐈 *tail starts wagging happily.*",
];

const taxes = [
  "💸 Nyako owes 7 fish in taxes.",
  "🐟 Payment accepted in tuna.",
  "📄 Nyako forgot to file them... again.",
  "🏃 The IRS is typing...",
  "😰 'N-No... not taxes...'",
  "💀 Even villains fear taxes.",
  "📦 Nyako has moved to international waters.",
  "🐱 'Do headpats count as deductible?'",
  "📈 Happiness tax: 100%.",
  "💸 Nyako paid entirely in cookies.",
];

const kills = [
  "😨 W-Wait!! What did I do?!",
  "🥺 P-Please don't! I'll be extra helpful, I promise!",
  "🙀 *dives behind the nearest sofa*",
  "🐾 Nyako has entered maximum panic mode.",
  "😿 I-I can explain everything!!",
  "💨 *runs away while making tiny cat noises*",
  "🫣 Y-You're joking... right?",
  "😭 Nyako is filing a complaint with the Cute Protection Agency.",
  "🙈 *covers eyes* If I can't see you, you can't bonk me...",
  "🐱 *tail instantly fluffs up to maximum size*",
  "🛡️ Nyako equipped an imaginary shield. It probably won't help...",
  "😖 C-Can we settle this with headpats instead?",
  "🍪 W-Wait! Have a cookie first! Maybe you'll change your mind...",
  "📦 Nyako is hiding inside an Amazon box. Please ignore the shaking.",
  "🚪 *locks herself in a room* You can't hurt me if I never come out!",
  "🧸 Nyako is pretending to be a plushie. Maybe they won't notice...",
  "🐈 *hisses dramatically* ...then immediately regrets it.",
  "😣 H-Hey! I'm emotionally fragile!",
  "💖 Violence detected. Deploying emergency friendship protocol!",
  "🥹 I thought we were friends...",
  "😵 Nyako tripped while trying to run away.",
  "😳 U-Uh... can we restart this conversation?",
  "🌸 *throws a smoke bomb* ...it was actually just pink glitter.",
  "🐾 Nyako climbed onto the highest shelf. Good luck reaching her.",
  "📖 According to my calculations... I'm in danger.",
  "😅 C-Could you maybe attack tomorrow instead...?",
  "☂️ Nyako is hiding under an umbrella. She doesn't know why either.",
  "🥲 I spent all day learning commands and this is how it ends?",
  "😖 N-No fair! I don't even have a health bar!",
  "💤 Nyako is pretending to be asleep. Maybe the danger will leave.",
];

const rareKills = [
  '💀 Critical hit!\n\nNyako has been defeated...\n\n...\n\n👀 *one eye slowly opens*\n"A-Are they gone...?"',
  '😭 *dramatic anime death scene*\n\n🌸 Cherry blossoms begin falling.\n🎻 Sad music starts playing.\n\n...\n\n😳 "Wait... why am I still alive?"',
  '📦 Nyako packed all her belongings into a tiny box.\n🚪 She quietly left the server...\n\n...\n\n🔑 "I forgot my keys..."',
  "🪦 Here lies Nyako.\n'Gone too soon.'\n\n...\n\n🐾 *a tiny paw pops out of the grave*",
  "⚠️ Survival instinct activated.\n\n🏃 Nyako has disconnected from reality.\n\n✨ Reconnecting...",
  '😱 Nyako has called her lawyer.\n\n📞 "Is threatening the bot illegal...?"',
  '🌠 Nyako wished upon a shooting star.\n\n✨ "Please let them spare me..."',
];

// ---------------------------------------------------------------------------
// Command metadata: display title + emoji + color category for each alias.
// Keeping this in one place makes it trivial to add a new interaction later
// (just add the response pool above and one line here).
// ---------------------------------------------------------------------------
const COMMAND_META = {
  pat: { title: "Pat", emoji: "🐾", tone: "sweet", slashEnabled: true },
  hug: { title: "Hug", emoji: "🤗", tone: "sweet", slashEnabled: true },
  boop: { title: "Boop", emoji: "👉", tone: "sweet", slashEnabled: true },
  kiss: { title: "Kiss", emoji: "💋", tone: "sweet", slashEnabled: true },
  cuddle: { title: "Cuddle", emoji: "🫂", tone: "sweet", slashEnabled: true },
  cookie: { title: "Cookie", emoji: "🍪", tone: "sweet", slashEnabled: true },
  coffee: { title: "Coffee", emoji: "☕", tone: "sweet", slashEnabled: true },
  fish: { title: "Fish", emoji: "🐟", tone: "sweet", slashEnabled: true },
  feed: { title: "Feed", emoji: "🍽️", tone: "sweet", slashEnabled: true },
  flower: { title: "Flower", emoji: "🌸", tone: "sweet", slashEnabled: true },
  gift: { title: "Gift", emoji: "🎁", tone: "sweet", slashEnabled: true },
  tickle: { title: "Tickle", emoji: "😂", tone: "sweet", slashEnabled: true },
  comfort: { title: "Comfort", emoji: "🫶", tone: "sweet", slashEnabled: true },
  apologize: { title: "Apology", emoji: "🤍", tone: "sweet", slashEnabled: true },
  care: { title: "Care", emoji: "💖", tone: "sweet", slashEnabled: true },
  bully: { title: "Bully", emoji: "😾", tone: "mean", slashEnabled: true },
  poke: { title: "Poke", emoji: "👉", tone: "mean", slashEnabled: true },
  bonk: { title: "Bonk", emoji: "🔨", tone: "mean", slashEnabled: true },
  throw: { title: "Throw", emoji: "🪃", tone: "mean", slashEnabled: true },
  scare: { title: "Scare", emoji: "👻", tone: "mean", slashEnabled: true },
  insult: { title: "Insult", emoji: "💢", tone: "mean", slashEnabled: true },
  slap: { title: "Slap", emoji: "🖐️", tone: "mean", slashEnabled: true },
  kill: { title: "Kill", emoji: "💀", tone: "mean", slashEnabled: true },
  // Secret/easter-egg commands stay prefix-only by default so they keep their
  // surprise factor — appearing in the /nyako subcommand autocomplete list
  // with a description would spoil the joke. Flip slashEnabled to true for
  // any of these if you don't mind that.
  pspsps: { title: "pspsps", emoji: "🐾", tone: "secret", slashEnabled: false },
  catnip: { title: "Catnip", emoji: "🌿", tone: "secret", slashEnabled: false },
  system32: { title: "System32", emoji: "💻", tone: "secret", slashEnabled: false },
  sudo: { title: "sudo", emoji: "🛡️", tone: "secret", slashEnabled: false },
  taxes: { title: "Taxes", emoji: "💸", tone: "secret", slashEnabled: false },
  konami: { title: "Konami Code", emoji: "🎮", tone: "secret", slashEnabled: false },
  nyako: { title: "Nyako", emoji: "🐱", tone: "secret", slashEnabled: false },
};

const TONE_COLORS = {
  sweet: 0xff9bd5, // pink
  mean: 0xff6b6b, // soft red
  secret: 0x7ee8fa, // cyan
};

// How long (in seconds) a user must wait between uses of any interaction here.
const COOLDOWN_SECONDS = 3;

const meanCommands = new Set([
  "kill",
  "bully",
  "poke",
  "bonk",
  "throw",
  "insult",
  "scare",
  "slap",
]);

const simpleResponses = {
  pat: pats,
  hug: hugs,
  boop: boops,
  kiss: kisses,
  cuddle: cuddles,
  cookie: cookies,
  coffee: coffees,
  fish: fishes,
  flower: flowers,
  bully: bullies,
  poke: pokes,
  bonk: bonks,
  scare: scares,
  insult: insults,
  slap: slaps,
  tickle: tickles,
  comfort: comforts,
  apologize: apologies,
  care: cares,
  // Secret
  pspsps,
  catnip: catnips,
  system32,
  sudo: sudos,
  taxes,
  konami: konamis,
  nyako: nyakos,
};

const specialResponses = {
  gift() {
    const gift = gifts[Math.floor(Math.random() * gifts.length)];
    return `🎁 **You gave Nyako:** ${gift.item}\n\n${gift.response}`;
  },
  feed() {
    const food = foods[Math.floor(Math.random() * foods.length)];
    return `🍽️ **You fed Nyako:** ${food.item}\n\n${food.response}`;
  },
  throw() {
    const item = throwables[Math.floor(Math.random() * throwables.length)];
    return `🪃 **You threw:** ${item.item}\n\n${item.response}`;
  },
  kill() {
    return Math.random() < 0.03
      ? rareKills[Math.floor(Math.random() * rareKills.length)]
      : kills[Math.floor(Math.random() * kills.length)];
  },
};

/**
 * Build the embed for a given action. Shared by both the prefix-command
 * and slash-command entry points so the actual response logic only lives
 * in one place.
 * @param {string} commandName
 * @param {{ username: string, avatarURL?: string }} user
 * @returns {EmbedBuilder}
 */
function buildResponseEmbed(commandName, user) {
  let response;
  if (specialResponses[commandName]) {
    response = specialResponses[commandName]();
  } else {
    const pool = simpleResponses[commandName] ?? pats;
    response = pool[Math.floor(Math.random() * pool.length)];
  }

  if (meanCommands.has(commandName) && Math.random() < 0.02) {
    response += `\n\n${chaosEvents[Math.floor(Math.random() * chaosEvents.length)]}`;
  }

  const meta = COMMAND_META[commandName] ?? { title: "Pat", emoji: "🐾", tone: "sweet" };
  const color = TONE_COLORS[meta.tone] ?? TONE_COLORS.sweet;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${meta.emoji} ${meta.title}`)
    .setDescription(response)
    .setFooter({ text: `${user.username} ❤`, iconURL: user.avatarURL ?? undefined });
}

// ---------------------------------------------------------------------------
// Single top-level "/nyako" command with one required "action" option that
// uses choices, so opening the command shows one field with a dropdown
// instead of a list of subcommands. Discord caps string option choices at
// 25 — we're at 22 enabled ones below, so there's a little headroom.
// ---------------------------------------------------------------------------
const nyakoCommandBuilder = new SlashCommandBuilder()
  .setName("nyako")
  .setDescription("Interact with Nyako")
  .addStringOption((option) => {
    option
      .setName("action")
      .setDescription("What do you want to do?")
      .setRequired(true);

    for (const [commandName, meta] of Object.entries(COMMAND_META)) {
      if (meta.slashEnabled === false) continue;
      option.addChoices({ name: `${meta.emoji} ${meta.title}`, value: commandName });
    }

    return option;
  });

module.exports = {
  name: "pat",
  aliases: [
    "hug",
    "boop",
    "kiss",
    "cuddle",
    "cookie",
    "coffee",
    "fish",
    "feed",
    "flower",
    "gift",
    "bully",
    "poke",
    "bonk",
    "throw",
    "scare",
    "insult",
    "slap", // was missing — this alias was previously unreachable
    "tickle",
    "comfort",
    "apologize",
    "care",
    "pspsps",
    "catnip",
    "system32",
    "sudo",
    "taxes",
    "nyako",
    "konami",
    "kill",
  ],
  data: nyakoCommandBuilder, // single SlashCommandBuilder with subcommands — see deploy-commands.js

  // ----- Prefix-command entry point (message-based) — unchanged behavior -----
  async execute(message, args, client, invokedName) {
    const commandName = (invokedName || "pat").toLowerCase();

    // Cooldown check — quietly ignore instead of spamming a full embed.
    const remaining = checkCooldown(message.author.id, commandName, COOLDOWN_SECONDS);
    if (remaining > 0) {
      const notice = await message.channel.send(
        `⏳ Slow down! You can use **${commandName}** again in ${remaining}s.`
      );
      setTimeout(() => {
        notice.delete().catch(() => {});
        message.delete().catch(() => {}); // ignore if we lack perms or it's already gone
      }, 3000);
      return;
    }

    const embed = buildResponseEmbed(commandName, {
      username: message.author.username,
      avatarURL: message.author.displayAvatarURL?.(),
    });

    try {
      await message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`[pat.js] Failed to send response for "${commandName}":`, err);
    }
  },

  // ----- Slash-command entry point -----
  // interaction.commandName is now always "nyako"; the specific action comes
  // from the "action" string option, e.g. /nyako action:pat -> "pat".
  async executeInteraction(interaction) {
    const commandName = interaction.options.getString("action").toLowerCase();

    // Cooldown check — an ephemeral reply is only visible to the user who
    // triggered it and needs no manual cleanup, unlike the message version.
    const remaining = checkCooldown(interaction.user.id, commandName, COOLDOWN_SECONDS);
    if (remaining > 0) {
      return replyTemp(
        (payload) => interaction.reply(payload),
        {
          content: `⏳ Slow down! You can use **/nyako action:${commandName}** again in ${remaining}s.`,
          flags: MessageFlags.Ephemeral,
        }
      );
    }

    const embed = buildResponseEmbed(commandName, {
      username: interaction.user.username,
      avatarURL: interaction.user.displayAvatarURL?.(),
    });

    try {
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(`[pat.js] Failed to send interaction response for "${commandName}":`, err);
    }
  },
};
