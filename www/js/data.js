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
