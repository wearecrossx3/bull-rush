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

  // price: listing price in rupees, vol: daily volatility, div: annual-ish dividend yield used for payouts
  BR.COMPANIES = [
    { tk: 'NMBS', name: 'NimbusSoft', sector: 'IT', price: 1450, vol: 0.022, div: 0.02, logo: '☁' },
    { tk: 'ORBT', name: 'Orbit Telecom', sector: 'TEL', price: 380, vol: 0.025, div: 0.01, logo: '◎' },
    { tk: 'KAIR', name: 'Kairo Motors', sector: 'AUTO', price: 920, vol: 0.026, div: 0.015, logo: '⚙' },
    { tk: 'LUMN', name: 'Lumen Pharma', sector: 'PHAR', price: 640, vol: 0.024, div: 0.012, logo: '✚' },
    { tk: 'BRIK', name: 'Brickstone Infra', sector: 'INFRA', price: 210, vol: 0.032, div: 0.008, logo: '▦' },
    { tk: 'SAFF', name: 'Saffron Foods', sector: 'FMCG', price: 1180, vol: 0.015, div: 0.025, logo: '❀' },
    { tk: 'IRON', name: 'Ironpeak Steel', sector: 'METAL', price: 165, vol: 0.034, div: 0.02, logo: '▲' },
    { tk: 'MERI', name: 'Meridian Bank', sector: 'BANK', price: 540, vol: 0.022, div: 0.018, logo: '◆' },
    { tk: 'SKYL', name: 'Skyline Airways', sector: 'AIR', price: 290, vol: 0.036, div: 0, logo: '✈' },
    { tk: 'ZENV', name: 'Zenvolt Power', sector: 'ENER', price: 125, vol: 0.03, div: 0.03, logo: '⚡' },
  ];

  BR.IPOS = [
    { tk: 'QNTC', name: 'QuantaChip Semis', sector: 'IT', price: 420, vol: 0.038, div: 0, logo: '◈', pitch: 'India\'s first fabless chip designer' },
    { tk: 'GLEV', name: 'GreenLeaf EV', sector: 'AUTO', price: 180, vol: 0.042, div: 0, logo: '❦', pitch: 'Electric scooters for small towns' },
    { tk: 'PAYW', name: 'Paywave Fintech', sector: 'BANK', price: 320, vol: 0.036, div: 0, logo: '₹', pitch: 'UPI payments for 40 lakh shops' },
    { tk: 'NOVA', name: 'NovaCure Health', sector: 'PHAR', price: 260, vol: 0.03, div: 0.005, logo: '✺', pitch: 'Hospital chain across tier-2 cities' },
  ];

  // Macro events: one is revealed every morning. fx maps sector -> % move, ALL applies to every stock.
  BR.MACRO = [
    { h: 'Central bank cuts repo rate by 50 bps', fx: { BANK: 7, INFRA: 5, AUTO: 4, ALL: 1 } },
    { h: 'Crude oil spikes to a 3-year high', fx: { AIR: -10, ENER: 6, AUTO: -3, FMCG: -2 } },
    { h: 'Weather office forecasts a strong monsoon', fx: { FMCG: 6, AUTO: 3, ALL: 1 } },
    { h: 'Global tech sell-off overnight in US markets', fx: { IT: -8, ALL: -2 } },
    { h: 'Government unveils ₹10 lakh crore infra push', fx: { INFRA: 10, METAL: 6, BANK: 2 } },
    { h: 'US drug regulator clears Indian plants', fx: { PHAR: 9 } },
    { h: 'Spectrum auction ends far above estimates', fx: { TEL: -7, BANK: -2 } },
    { h: 'Rupee slides to a record low against the dollar', fx: { IT: 5, AIR: -5, PHAR: 3 } },
    { h: 'Import duty on steel raised to 15%', fx: { METAL: 8, AUTO: -2, INFRA: -2 } },
    { h: 'Stable government wins clear majority', fx: { ALL: 4 } },
    { h: 'Poll survey hints at a hung parliament', fx: { ALL: -4 } },
    { h: 'Foreign funds pour in record inflows', fx: { ALL: 3, BANK: 3 } },
    { h: 'Bad-loan worries resurface at lenders', fx: { BANK: -9, INFRA: -3 } },
    { h: 'EV subsidy scheme extended by 3 years', fx: { AUTO: 6, ENER: 4 } },
    { h: 'Festive season air travel hits a record', fx: { AIR: 9, FMCG: 2 } },
    { h: 'Strict new data-privacy law passed', fx: { IT: -4, TEL: -3 } },
    { h: 'Quiet session expected, no big triggers', fx: {} },
    { h: 'New virus scare spreads across Asia', fx: { ALL: -5, PHAR: 8, AIR: -10 } },
    { h: 'Budget surprise: corporate tax cut', fx: { ALL: 5 } },
    { h: 'Inflation data comes in hotter than expected', fx: { ALL: -3, FMCG: -3, BANK: -3 } },
    { h: 'Coal shortage hits power plants', fx: { ENER: -7, METAL: -3 } },
    { h: '5G rollout ahead of schedule', fx: { TEL: 8, IT: 2 } },
    { h: 'Car sales jump 22% year on year', fx: { AUTO: 8, METAL: 2 } },
    { h: 'Rural demand slows for third quarter', fx: { FMCG: -6, AUTO: -3 } },
  ];

  // Private tip headlines. {n} is replaced by the company name.
  BR.TIPS_UP = [
    'Quarterly profit beats estimates by a wide margin', 'Wins a ₹5,000 crore export order',
    'Brokerage upgrades stock to Strong Buy', 'Promoters quietly raising their stake',
    'New product launch sold out in days', 'Debt-free status expected this year',
    'Big foreign fund building a position', 'Merger talks with a global player',
    'Patent approved for flagship product', 'Government contract nearly finalised',
  ];
  BR.TIPS_DOWN = [
    'Quarterly results likely to disappoint', 'CEO set to resign next week',
    'Factory fire halts production', 'Tax raid underway at head office',
    'Promoters pledging shares for loans', 'Key client cancels a large contract',
    'Brokerage downgrades stock to Sell', 'Auditor raises accounting questions',
    'Labour strike at main plant', 'Product recall in export markets',
  ];

  // Power cards: one may be played per day.
  BR.POWERS = {
    BULL: { name: 'Bull Charge', icon: '🐂', desc: 'Pump a stock +7% right now.', target: 'stock' },
    BEAR: { name: 'Bear Raid', icon: '🐻', desc: 'Hammer a stock −7% right now.', target: 'stock' },
    PEEK: { name: 'Insider Peek', icon: '🔍', desc: 'See one secret tip from every rival.', target: 'none' },
    SHIELD: { name: 'Stop-Loss Shield', icon: '🛡', desc: 'If a stock you hold closes below today\'s open, the bank covers the loss.', target: 'stock' },
  };

  BR.RULES = {
    startCash: 1000000,
    circuit: 0.2,          // daily upper/lower circuit
    brokerage: 0.001,      // 0.1% per trade
    impact: 0.6,           // price impact per 100% of float traded
    loanRate: 0.015,       // per trading day
    fdRate: 0.006,         // per trading day
    loanLtv: 0.5,          // loan limit as share of assets
    baseCredit: 200000,    // unsecured credit line
    marginCall: 0.8,       // loan / assets that triggers forced selling
    tipsPerDay: 3,
    rumorTruth: 0.55,      // chance a rumour turns out true
    pennyFloor: 10,        // below this the company goes insolvent
  };
})(window.BR = window.BR || {});
