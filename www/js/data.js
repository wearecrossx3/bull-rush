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
  };

  // start: opening price on the board (₹ per share). Shares trade in blocks of 1,000.
  BR.COMPANIES = [
    { tk: 'ZENV', name: 'Zenvolt Power', sector: 'ENER', start: 20, logo: '⚡' },
    { tk: 'BRIK', name: 'Brickstone Infra', sector: 'INFRA', start: 30, logo: '▦' },
    { tk: 'ORBT', name: 'Orbit Telecom', sector: 'TEL', start: 40, logo: '◎' },
    { tk: 'LUMN', name: 'Lumen Pharma', sector: 'PHAR', start: 55, logo: '✚' },
    { tk: 'MERI', name: 'Meridian Bank', sector: 'BANK', start: 65, logo: '◆' },
    { tk: 'KAIR', name: 'Kairo Motors', sector: 'AUTO', start: 80, logo: '⚙' },
    { tk: 'SAFF', name: 'Saffron Foods', sector: 'FMCG', start: 90, logo: '❀' },
    { tk: 'NMBS', name: 'NimbusSoft', sector: 'IT', start: 100, logo: '☁' },
  ];

  BR.IPOS = [
    { tk: 'QNTC', name: 'QuantaChip', sector: 'METAL', start: 50, logo: '◈', pitch: 'India\'s first fabless chip designer' },
    { tk: 'GLEV', name: 'GreenLeaf EV', sector: 'AIR', start: 30, logo: '❦', pitch: 'Electric scooters for small towns' },
    { tk: 'PAYW', name: 'Paywave', sector: 'BANK', start: 45, logo: '₹', pitch: 'UPI payments for 40 lakh shops' },
  ];

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
  };

  BR.RULES = {
    startCash: 500000,
    block: 1000,          // shares per block
    priceCards: 7,        // price cards per player per round
    specialChance: 0.75,  // chance of a special card in your hand each round
    splitAt: 250,         // price where a 1:1 bonus kicks in
    dividend: 5,
    supply: 100000,       // shares of each company on the table
    rightsMax: 5000,      // most rights shares one card can give
    bossMin: 5000,        // shares needed to become a company's Big Boss
    loanStep: 100000,
    loanMax: 300000,
    loanRate: 0.1,        // per round
    ipoMaxBlocks: 5,
  };
})(window.BR = window.BR || {});
