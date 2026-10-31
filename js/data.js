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
  };
})(window.BR = window.BR || {});
