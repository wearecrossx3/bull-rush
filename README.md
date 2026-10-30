# Bull Rush

An original, landscape stock-market trading game for Android. Trade fictional companies against bots or friends online, chase IPOs, use the bank, and finish with the highest net worth.

All companies, events, cards and artwork in this game are original and fictional.

## Features

- Live trading days with a countdown timer, intraday price ticks, candles and a market index (RUSH 30)
- Secret tips (some are rumours) that move prices at the closing bell
- Real-market rules: price impact of big orders, 0.1% brokerage, ±20% circuit limits, insolvency
- Corporate actions: dividends, bonus, splits, rights issues, buybacks, regulator probes
- IPOs mid-game with a live subscription meter, grey market premium, lottery allotment and listing day
- Rush Bank: loans with margin calls, fixed deposits
- Power cards: Bull Charge, Bear Raid, Insider Peek, Stop-Loss Shield
- 1 to 5 bots with three skill levels; auto-save after every day
- Online rooms for up to 6 players (PeerJS, host runs the game)

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
