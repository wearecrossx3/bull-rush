# Bull Rush

An original, landscape stock-market trading game for Android. Trade fictional companies against bots or friends online, chase IPOs, use the bank, and finish with the highest net worth.

All companies, events, cards and artwork in this game are original and fictional.

## Features

- Turn-based tabletop play: every round each player is dealt secret price cards (like "KAIR +15")
- Take turns around the table: buy or sell blocks of 1,000 shares, apply for an IPO, play a gold card, or pass
- Big reveal at the end of each round: all cards flip and each company moves by its total
- Bankruptcy at ₹0 wipes shares; a 1:1 bonus at ₹250 doubles them
- Gold cards: Bull Run, Bear Attack, Safe Shield, Double Trouble, Dividend Day, Bonus Gift, Monsoon Boom, Market Crash, Broker Fees
- IPOs mid-game with fair-share allotment, and a bank for ₹1 lakh loans
- 1 to 5 bots with three skill levels; auto-save every round
- Online rooms for up to 6 players (PeerJS, host runs the game)
- Cosy wooden-table cartoon look, landscape only

## Layout

```
www/            the game (plain HTML/CSS/JS, no build step)
  js/data.js    companies, events, tips, rules
  js/engine.js  game state and rules (shared by offline and online host)
  js/bots.js    computer traders
  js/net.js     online rooms
  js/ui.js      screens and rendering
android/        native WebView shell and APK build script
```

Play in a browser: open `www/index.html`.

## Building the APK

`android/build.py` builds a signed APK without Gradle or the Android SDK build tools. It needs JDK 17+, Python 3 and three jars in `$BR_SDK` (default `/tmp/claude-0/sdk`):

- `android-34.jar` (Android platform jar)
- `dx.jar` (`com.jakewharton.android.repackaged:dalvik-dx`)
- `apksig.jar` (`com.android.tools.build:apksig:2.3.0`)

```
BR_KEYSTORE=/path/to/bullrush.p12 BR_VERSION_CODE=2 BR_VERSION_NAME=1.1 python3 android/build.py
```

Keep the same keystore for every release, otherwise Android refuses to install an update over the old version. The keystore is not committed.
