# Bull Rush

An original stock-market trading game for Android. Trade fictional companies against bots or friends online, chase IPOs, use the bank, and finish with the highest net worth.

All companies, events, cards and artwork in this game are original and fictional.

## Features

- Turn-based tabletop play: every round each player is dealt 7 secret price cards (like "KAIR +15"), dealt fairly so every hand has rises and falls
- Take turns around the table: buy or sell blocks of 1,000 shares, apply for an IPO, play a gold card, or pass
- Big reveal at the end of each round: all cards flip one by one and each company moves by its total
- Bankruptcy at ₹0 wipes shares; a 1:1 bonus at ₹250 doubles them
- 3 gold cards each at the start, kept until played; players in the bottom half get a catch-up card after every reveal
- 15 gold cards: Rights Offer, Scam Exposed, Trading Freeze, Rupee Rocket, Rupee Slide, Upper Limit, Lower Limit, Dividend Day, Spy Glass, Bull Charge, Double Trouble, Safety Net, Insider Tip, Tax Raid, Lucky Bonus
- Average buy price and profit/loss for every holding
- Reach ₹1 Cr net worth to list your own company through an IPO
- Co-owner (top holder with 20,000+ shares) cancels the worst minus card; Owner (50,000+) cancels the two worst
- Market brain: expensive stocks lean down, beaten-down stocks lean up, long streaks tire out
- Bank: credit of ₹2 lakh plus half your shares, 5% interest per round, fixed deposits at 2%, margin calls
- Every company gets a random logo each game; deed-card tiles show price, chart and top holders
- Tap any player to see their holdings and latest moves; trade list of every move at the table; shares dashboard
- Rival moves pop up as bubbles; bots take a realistic moment to think
- Money-stack animations, round banners, card flips, confetti and synthesised sound effects
- 1 to 5 bots with three skill levels; auto-save every round
- Online rooms for up to 6 players (PeerJS, host runs the game)
- Clean, minimal look that works on phones and iPads, portrait and landscape
- Home screen with Quick Game, stats and settings (sound, vibration, bot speed)

## Web app (iPhone / iPad)

The `gh-pages` branch serves `www/` at https://wearecrossx3.github.io/bull-rush/. Open it in Safari and use Share → Add to Home Screen; it then runs full-screen and works offline (`sw.js`).

## Layout

```
www/            the game (plain HTML/CSS/JS, no build step)
  js/data.js    companies, events, tips, rules
  js/engine.js  game state and rules (shared by offline and online host)
  js/bots.js    computer traders
  js/net.js     online rooms
  js/ui.js      screens and rendering
android/        native WebView shell and APK build script
art/            app icon source (icon.html) and a 512px render
```

Play in a browser: open `www/index.html`.

## Building the APK

`android/build.py` builds a signed APK without Gradle or the Android SDK build tools. It needs JDK 17+, Python 3 and three jars in `$BR_SDK` (default `/tmp/claude-0/sdk`):

- `android-34.jar` (Android platform jar)
- `dx.jar` (`com.jakewharton.android.repackaged:dalvik-dx`)
- `apksig.jar` (`com.android.tools.build:apksig:2.3.0`)

```
BR_KEYSTORE=/path/to/bullrush.p12 BR_VERSION_CODE=4 BR_VERSION_NAME=4.0 python3 android/build.py
```

Keep the same keystore for every release, otherwise Android refuses to install an update over the old version. The keystore is not committed.
