// Bull Rush: static game content. All companies, events and cards are fictional.
(function (BR) {
  BR.SECTORS = {
    IT: { name: 'IT', color: '#5b8cff' },
    TEL: { name: 'Telecom', color: '#b46cff' },
    AUTO: { name: 'Auto', color: '#ff8a3d' },
    PHAR: { name: 'Pharma', color: '#2fd0c6' },
    INFRA: { name: 'Infra', color: '#c9a36b' },
    FMCG: { name: 'FMCG', color: '#7ed957' },
    METAL: { name: 'Metals', color: '#9aa7b8' },
    BANK: { name: 'Banking', color: '#ffd23f' },
    AIR: { name: 'Aviation', color: '#5fd3ff' },
    ENER: { name: 'Energy', color: '#ff5c8a' },
    OWN: { name: 'Startup', color: '#f5b700' },
  };

  // Minimal flat logo for each pool company: brand colour `c` and a white mark (art/company-logos.js).
  // A mark gets the tile colour so it can cut shapes out of itself.
  BR.LOGOS = {
  ZENV: { c: '#F2A900', m: () => '<polygon points="23,5 10,22 19,22 16,35 30,17 21,17" fill="#fff"/>' },
  BRIK: { c: '#C4552D', m: () => '<g fill="#fff"><rect x="8" y="10" width="11" height="5.5" rx="1.2"/><rect x="21" y="10" width="11" height="5.5" rx="1.2"/><rect x="8" y="17.3" width="5" height="5.5" rx="1.2"/><rect x="15" y="17.3" width="10" height="5.5" rx="1.2"/><rect x="27" y="17.3" width="5" height="5.5" rx="1.2"/><rect x="8" y="24.6" width="11" height="5.5" rx="1.2"/><rect x="21" y="24.6" width="11" height="5.5" rx="1.2"/></g>' },
  ORBT: { c: '#2563EB', m: () => '<circle cx="20" cy="20" r="6.5" fill="#fff"/><ellipse cx="20" cy="20" rx="14" ry="5.5" fill="none" stroke="#fff" stroke-width="2.4" transform="rotate(-25 20 20)"/><circle cx="31.5" cy="13" r="2.4" fill="#fff"/>' },
  VYOM: { c: '#3B2F8F', m: (B) => `<circle cx="18" cy="21" r="11" fill="#fff"/><circle cx="23.5" cy="16.5" r="9.5" fill="${B}"/><path d="M29 22 L30.2 25.8 L34 27 L30.2 28.2 L29 32 L27.8 28.2 L24 27 L27.8 25.8 Z" fill="#fff"/>` },
  LUMN: { c: '#0E9F8E', m: () => '<g transform="rotate(45 20 20)"><rect x="13" y="7" width="14" height="26" rx="7" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M13 20 H27 V26 A7 7 0 0 1 13 26 Z" fill="#fff"/></g>' },
  NOVA: { c: '#E0457B', m: () => '<g fill="#fff"><rect x="16" y="8" width="8" height="24" rx="2.5"/><rect x="8" y="16" width="24" height="8" rx="2.5"/></g>' },
  MERI: { c: '#1E3A5F', m: () => '<g fill="#fff"><polygon points="20,7 33,14.5 7,14.5"/><rect x="9.5" y="17" width="4.5" height="10.5" rx="1"/><rect x="17.75" y="17" width="4.5" height="10.5" rx="1"/><rect x="26" y="17" width="4.5" height="10.5" rx="1"/><rect x="7" y="29.5" width="26" height="3.5" rx="1"/></g>' },
  PAYW: { c: '#7C3AED', m: () => '<g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M11 16 Q14 20 11 24"/><path d="M17 12 Q22.5 20 17 28"/><path d="M23 8 Q31 20 23 32"/></g>' },
  KAIR: { c: '#D7263D', m: () => '<circle cx="20" cy="20" r="11.5" fill="none" stroke="#fff" stroke-width="3"/><circle cx="20" cy="20" r="3.4" fill="#fff"/><g stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M20 16.6 V9.5"/><path d="M17 21.7 L10.9 25.2"/><path d="M23 21.7 L29.1 25.2"/></g>' },
  SAFF: { c: '#F97316', m: (B) => `<g fill="#fff">${[0, 60, 120].map((a) => `<ellipse cx="20" cy="20" rx="3.8" ry="12" transform="rotate(${a} 20 20)"/>`).join('')}</g><circle cx="20" cy="20" r="3.2" fill="${B}"/>` },
  TALA: { c: '#B83280', m: (B) => `<g fill="#fff"><rect x="10" y="7" width="20" height="4.5" rx="2"/><rect x="10" y="28.5" width="20" height="4.5" rx="2"/><rect x="13" y="11.5" width="14" height="17"/></g><g stroke="${B}" stroke-width="1.6"><path d="M13 15.5 H27"/><path d="M13 20 H27"/><path d="M13 24.5 H27"/></g>` },
  NMBS: { c: '#0EA5E9', m: (B) => `<path d="M12.5 29 A6.5 6.5 0 0 1 11.5 16.1 A8.5 8.5 0 0 1 27.6 14.2 A7.4 7.4 0 0 1 28 29 Z" fill="#fff"/><g fill="none" stroke="${B}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19 L14.5 22.5 L17.5 26"/><path d="M22.5 19 L25.5 22.5 L22.5 26"/></g>` },
  IRON: { c: '#475569', m: () => '<polygon points="5,32 16,12 22.5,22 26.5,16.5 35,32" fill="#fff"/>' },
  QNTC: { c: '#16A34A', m: (B) => `<g fill="#fff">${[15, 20, 25].map((p) => `<rect x="${p - 1}" y="7" width="2" height="5" rx="1"/><rect x="${p - 1}" y="28" width="2" height="5" rx="1"/><rect x="7" y="${p - 1}" width="5" height="2" rx="1"/><rect x="28" y="${p - 1}" width="5" height="2" rx="1"/>`).join('')}<rect x="11.5" y="11.5" width="17" height="17" rx="3"/></g><rect x="16" y="16" width="8" height="8" rx="1.5" fill="${B}"/>` },
  SKYL: { c: '#0891B2', m: (B) => `<path d="M6 21 L34 8 L24.5 33 L19.5 23.5 Z" fill="#fff"/><path d="M19.5 23.5 L34 8" stroke="${B}" stroke-width="1.8"/>` },
  GLEV: { c: '#65A30D', m: (B) => `<path d="M8 32 C8 17 17 8 32 8 C32 23 23 32 8 32 Z" fill="#fff"/><path d="M22.5 13 L16.5 21 H21.5 L17.5 28" fill="none" stroke="${B}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>` },
  };

  // Pool of fictional companies; each game picks 8 for the board and 3 more for IPOs,
  // and gives every one a random logo.
  BR.COMPANY_POOL = [
    { tk: 'ZENV', name: 'Zenvolt Power', sector: 'ENER', pitch: 'Solar farms on every rooftop' },
    { tk: 'BRIK', name: 'Brickstone Infra', sector: 'INFRA', pitch: 'Bridges, metros and highways' },
    { tk: 'ORBT', name: 'Orbit Telecom', sector: 'TEL', pitch: '5G towers in every village' },
    { tk: 'LUMN', name: 'Lumen Pharma', sector: 'PHAR', pitch: 'Low-cost medicines for the world' },
    { tk: 'MERI', name: 'Meridian Bank', sector: 'BANK', pitch: 'Loans for small businesses' },
    { tk: 'KAIR', name: 'Kairo Motors', sector: 'AUTO', pitch: 'Family cars and tractors' },
    { tk: 'SAFF', name: 'Saffron Foods', sector: 'FMCG', pitch: 'Snacks, tea and spices' },
    { tk: 'NMBS', name: 'NimbusSoft', sector: 'IT', pitch: 'Cloud software for banks' },
    { tk: 'IRON', name: 'Ironpeak Steel', sector: 'METAL', pitch: 'Steel for a growing country' },
    { tk: 'SKYL', name: 'Skyline Air', sector: 'AIR', pitch: 'Cheap flights to small cities' },
    { tk: 'TALA', name: 'Tala Textiles', sector: 'FMCG', pitch: 'Cotton from farm to fashion' },
    { tk: 'VYOM', name: 'Vyom Space', sector: 'TEL', pitch: 'Tiny satellites, big dreams' },
    { tk: 'QNTC', name: 'QuantaChip', sector: 'METAL', pitch: 'India\'s first fabless chip designer' },
    { tk: 'GLEV', name: 'GreenLeaf EV', sector: 'AIR', pitch: 'Electric scooters for small towns' },
    { tk: 'PAYW', name: 'Paywave', sector: 'BANK', pitch: 'UPI payments for 40 lakh shops' },
    { tk: 'NOVA', name: 'NovaCure Health', sector: 'PHAR', pitch: 'Hospitals across tier-2 cities' },
  ];
  BR.START_PRICES = [20, 30, 40, 55, 65, 80, 90, 100];
  BR.IPO_PRICES = [30, 45, 50];

  // Special (gold) cards: playing one uses your turn. target = needs a company.
  BR.SPECIALS = {
    RIGHTS: { name: 'Rights Offer', icon: '🎟', target: true, own: true, desc: 'Buy 1 extra share for every 2 you own, at half price, right now.' },
    SCAM: { name: 'Scam Exposed', icon: '🚨', target: true, desc: 'Company crashes −₹40 at the reveal.' },
    FREEZE: { name: 'Trading Freeze', icon: '🔒', target: true, desc: 'Company does not move at all this round.' },
    RUPUP: { name: 'Rupee Rocket', icon: '🚀', target: false, desc: 'Every company rises 10% at the reveal.' },
    RUPDN: { name: 'Rupee Slide', icon: '📉', target: false, desc: 'Every company falls 10% at the reveal.' },
    UPCAP: { name: 'Upper Limit', icon: '🚧', target: true, desc: 'Company can rise at most +₹15 this round.' },
    LOWCAP: { name: 'Lower Limit', icon: '🪂', target: true, desc: 'Company can fall at most −₹15 this round.' },
    DIVIDEND: { name: 'Dividend Day', icon: '💰', target: true, desc: 'Every holder gets ₹5 per share at the reveal.' },
    SPY: { name: 'Spy Glass', icon: '🔍', target: false, desc: 'Secretly see one rival\'s whole hand.' },
    CHARGE: { name: 'Bull Charge', icon: '🐂', target: true, desc: 'Company jumps +₹25 at the reveal.' },
    DOUBLE: { name: 'Double Trouble', icon: '🎲', target: true, desc: 'Company moves twice as much this round, up or down.' },
    NET: { name: 'Safety Net', icon: '🛟', target: true, own: true, desc: 'If this company falls this round, the bank pays you back the loss on your shares.' },
    TIP: { name: 'Insider Tip', icon: '🕵️', target: false, desc: 'Peek at the hidden market cards for this round.' },
    TAX: { name: 'Tax Raid', icon: '🧾', target: false, desc: 'The richest rival pays 5% of their net worth to the bank.' },
    LUCKY: { name: 'Lucky Bonus', icon: '🎁', target: false, desc: 'Collect ₹1 lakh cash right now.' },
    SHORT: { name: 'Short Sell', icon: '🐻', target: true, desc: 'Bet on a fall: earn ₹10,000 for every ₹1 it drops at the reveal. If it rises you pay the same (at most ₹2 lakh).' },
    MOON: { name: 'Moonshot', icon: '🌙', target: true, desc: 'Company shoots up +₹40 at the reveal.' },
    BOOM: { name: 'Sector Boom', icon: '🌱', target: true, desc: 'Every company in the same sector rises +₹15 at the reveal.' },
    SLUMP: { name: 'Sector Slump', icon: '🌧', target: true, desc: 'Every company in the same sector falls −₹15 at the reveal.' },
    HYPE: { name: 'Viral Hype', icon: '📱', target: true, desc: 'If this company rises this round, the rise is tripled.' },
    PANIC: { name: 'Panic Wave', icon: '😱', target: true, desc: 'If this company falls this round, the fall is tripled.' },
    FLIP: { name: 'Mirror Card', icon: '🪞', target: true, desc: 'This company\'s move is flipped: a rise becomes a fall and a fall becomes a rise.' },
    ANCHOR: { name: 'Anchor', icon: '⚓', target: true, desc: 'Company moves at most ₹5 up or down this round.' },
    MEGADIV: { name: 'Mega Dividend', icon: '💸', target: true, desc: 'Every holder gets ₹15 per share at the reveal.' },
    SPLIT: { name: 'Stock Split', icon: '✂️', target: true, desc: 'At the reveal every holder\'s shares double and the price halves.' },
    LOCK: { name: 'Lockdown', icon: '⛔', target: true, desc: 'Nobody can sell this company until the reveal.' },
    SWAN: { name: 'Black Swan', icon: '🦢', target: false, desc: 'A random company crashes −₹50 at the reveal. Nobody knows which, not even you!' },
    STAR: { name: 'Lucky Star', icon: '⭐', target: false, desc: 'A random company jumps +₹50 at the reveal.' },
    VIP: { name: 'IPO VIP Pass', icon: '🎫', target: false, desc: 'Your IPO application this round is filled in full, even if it is oversubscribed.' },
    GOLDFD: { name: 'Golden Deposit', icon: '🏦', target: false, desc: 'Your fixed deposit earns an extra 15% at the reveal.' },
    BUYBACK: { name: 'Buyback', icon: '🔁', target: true, own: true, desc: 'The company buys back all your shares right now at 20% above the price.' },
    ANGEL: { name: 'Angel Investor', icon: '😇', target: true, desc: 'Get free shares of this company right now (10,000 or more as you get richer).' },
    JACKPOT: { name: 'Jackpot', icon: '🎰', target: false, desc: 'Win 5% of your net worth in cash right now (at least ₹2.5 lakh).' },
    FORTUNE: { name: 'Fortune Cookie', icon: '🥠', target: false, desc: 'A surprise cash prize: anything from ₹50,000 up to 8% of your net worth.' },
    PICK: { name: 'Pickpocket', icon: '🦝', target: false, desc: 'Take 3% of every rival\'s cash right now.' },
    ROBIN: { name: 'Robin Hood', icon: '🏹', target: false, desc: 'The richest player pays 4% of their net worth, shared by everyone else. Careful if that is you!' },
    WAIVER: { name: 'Loan Waiver', icon: '🕊', target: false, desc: 'The bank forgives half your loan (up to ₹25 lakh).' },
    DOUBLEUP: { name: 'Double Up', icon: '✌️', target: false, desc: 'Get 2 new gold cards right now.' },
    REDRAW: { name: 'Lucky Redraw', icon: '🔄', target: false, desc: 'Swap your 2 worst price cards for 2 random cards from the market.' },
    CRYSTAL: { name: 'Crystal Ball', icon: '🔮', target: true, desc: 'See every price card for this company this round, in every hand and the market.' },
  };

  // Event rounds: every third round (and always the last one) has its own twist.
  BR.EVENTS = {
    BULLRUN: { name: 'Bull Run', icon: '🐂', desc: 'Every plus card counts double this round.' },
    CRASH: { name: 'Market Crash', icon: '🐻', desc: 'Every minus card counts double this round.' },
    BUDGET: { name: 'Budget Day', icon: '🏛', desc: 'The budget moves every sector up or down by ₹10 at the reveal.' },
    DIVFEST: { name: 'Dividend Festival', icon: '🪔', desc: 'Every company pays ₹5 per share at the reveal.' },
    GOLDRAIN: { name: 'Gold Rain', icon: '🌟', desc: 'Everyone gets a free gold card.' },
    BANKHOL: { name: 'Bank Holiday', icon: '🏖', desc: 'No loan interest this round, and deposits earn 10%.' },
    FRENZY: { name: 'Closing Bell Frenzy', icon: '🔔', desc: 'Final round: every price move counts double!' },
  };

  // Secret missions: two hidden goals per player, paid as a cash bonus (x times the starting money).
  BR.MISSIONS = {
    OWNER: { name: 'Big Boss', icon: '👑', desc: 'Be the 👑 Owner of any company at a reveal.', x: 0.5 },
    DIVERSE: { name: 'Spread Out', icon: '🧺', desc: 'Hold shares in 5 different companies at once.', x: 0.4 },
    DOUBLE: { name: 'Double Up', icon: '✖️', desc: 'Double your starting net worth.', x: 0.6 },
    BIGROUND: { name: 'Hot Streak', icon: '🔥', desc: 'Grow your net worth by 25% in a single round.', x: 0.5 },
    CASH: { name: 'Cash King', icon: '💵', desc: 'Have 1.5 times your starting money as cash at a reveal.', x: 0.4 },
    FD: { name: 'Safe Saver', icon: '🏦', desc: 'Keep half your starting money in a fixed deposit at a reveal.', x: 0.3 },
    GOLD3: { name: 'Card Shark', icon: '🃏', desc: 'Play 3 gold cards in one game.', x: 0.3 },
    IPO: { name: 'First in Line', icon: '🚀', desc: 'Get shares in an IPO.', x: 0.3 },
    FOUND: { name: 'Founder', icon: '🏢', desc: 'Found your own company.', x: 0.8 },
    BOSS: { name: 'Raider', icon: '🦈', desc: 'Take over a company.', x: 0.8 },
    LOAN: { name: 'Debt Free', icon: '🕊', desc: 'Take a bank loan and pay it all back.', x: 0.3 },
    BAGGER: { name: 'Multibagger', icon: '📈', desc: 'Own a stock at double your average buy price.', x: 0.6 },
  };

  // Emoji and quick-chat reactions anyone can send at any time.
  BR.REACTS = ['😂', '😎', '😱', '😡', '🔥', '👏', '🤑', '😭', 'Good move!', 'Oh no!', 'Hurry up!', 'Well played', 'Watch this', 'Sorry!'];

  // Market news: one headline opens most rounds and nudges a whole sector at the reveal.
  BR.NEWS = [
    { sector: 'IT', d: 10, text: 'Global tech giants sign big outsourcing deals' },
    { sector: 'IT', d: -10, text: 'New visa rules hit software exporters' },
    { sector: 'TEL', d: 10, text: 'Government opens new 5G spectrum at low prices' },
    { sector: 'TEL', d: -5, text: 'Price war breaks out between mobile networks' },
    { sector: 'AUTO', d: 10, text: 'Festive season: car bookings at a record high' },
    { sector: 'AUTO', d: -10, text: 'Fuel prices jump, buyers delay new cars' },
    { sector: 'PHAR', d: 10, text: 'New medicine gets fast-track approval' },
    { sector: 'PHAR', d: -5, text: 'Price caps announced on common medicines' },
    { sector: 'INFRA', d: 10, text: 'Budget doubles spending on roads and metros' },
    { sector: 'INFRA', d: -5, text: 'Heavy monsoon stalls construction sites' },
    { sector: 'FMCG', d: 5, text: 'Good rains: village demand is booming' },
    { sector: 'FMCG', d: -5, text: 'Sugar and oil prices squeeze snack makers' },
    { sector: 'METAL', d: 10, text: 'Steel demand soars on new factories' },
    { sector: 'METAL', d: -10, text: 'Cheap imports flood the metal market' },
    { sector: 'BANK', d: 10, text: 'Central bank cuts interest rates' },
    { sector: 'BANK', d: -10, text: 'Bad loans rise at lenders' },
    { sector: 'AIR', d: 10, text: 'Holiday season: flights sold out' },
    { sector: 'AIR', d: -10, text: 'Jet fuel price shoots up' },
    { sector: 'ENER', d: 10, text: 'Green energy subsidy announced' },
    { sector: 'ENER', d: -5, text: 'Power tariffs frozen for a year' },
    { all: 5, text: 'Foreign investors pour money into the market' },
    { all: -5, text: 'Global markets wobble, investors turn nervous' },
    { dividend: 2, text: 'Dividend season: every company pays ₹2 per share' },
    { all: 10, text: 'Festival rally! Markets celebrate a record Diwali' },
    { all: -10, text: 'Flash crash! A big fund dumps shares in panic' },
    { dividend: 5, text: 'Bumper profits: every company pays ₹5 per share' },
    { sector: 'IT', d: 15, text: 'AI boom: software orders explode' },
    { sector: 'BANK', d: -15, text: 'Big loan scandal shakes the banks' },
    { sector: 'ENER', d: 15, text: 'Huge new oil and gas find announced' },
  ];

  BR.RULES = {
    startCash: 500000,
    block: 1000,          // shares per block
    priceCards: 7,        // price cards per player per round
    startGold: 3,         // gold cards everyone starts with (kept between rounds)
    maxGold: 5,
    splitAt: 250,         // price where a 1:1 bonus kicks in
    dividend: 5,
    supply: 100000,       // shares of each company on the table
    rightsMax: 5000,      // most rights shares one card can give
    coOwnerAt: 20000,     // top holder with this many shares blocks the worst minus card
    ownerAt: 50000,       // ...and with this many, the two worst
    baseCredit: 200000,   // the bank lends this much on trust
    loanLtv: 0.5,         // plus half the value of your shares and deposits
    loanStep: 100000,
    loanRate: 0.05,       // per round
    fdRate: 0.02,         // per round
    marginAt: 0.7,        // loan above 70% of everything you own -> bank sells your shares
    ipoMaxBlocks: 5,
    founderAt: 10000000,  // net worth needed to list your own company (₹1 Cr)
    listingFee: 1000000,  // paid in cash to list it
    founderShares: 30000, // promoter shares the founder keeps
    founderIssue: [30, 50, 80],
    shortPerRupee: 10000, // Short Sell pays this much per ₹1 fall
    shortMaxLoss: 200000,
    botThink: [1.8, 3.6], // seconds a bot "thinks" before acting
    // empire: each extra company of your own needs more net worth and a bigger listing fee
    empire: [{ at: 10000000, fee: 1000000, shares: 30000 }, { at: 50000000, fee: 2500000, shares: 50000 }, { at: 250000000, fee: 10000000, shares: 100000 }],
    maxCompanies: 16,
    takeoverAt: 0.5,      // own half a company's shares to take control of it
    keepControl: 0.25,    // drop below a quarter and you lose control
    hostileAt: 0.2,       // a rival with 20% can make a hostile bid...
    hostilePremium: 1.3,  // ...buying the boss out at 30% above the price
    bossProfit: 0.01,     // the boss earns 1% of the company's value every round
    issueAt: 0.2,         // when less than 20% of a company's shares are left, it issues more
    issueMax: 2000000,    // ...up to 20 lakh shares in total
    // net worth titles; reaching one is celebrated and earns a gold card
    tiers: [{ at: 10000000, name: 'Crorepati', icon: '💼' }, { at: 100000000, name: 'Tycoon', icon: '🏙' }, { at: 1000000000, name: 'Billionaire', icon: '💎' }, { at: 10000000000, name: 'Empire', icon: '👑' }],
  };
})(window.BR = window.BR || {});
