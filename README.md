# Odogwu-Calc

A dark, glassmorphic calculator with scientific tools, live FX, units conversion, programmer mode, and local AI math assist. Built by Collins Anyanwu.

**Live app:** [https://lumen-calc-iota.vercel.app](https://lumen-calc-iota.vercel.app)  
**GitHub:** [collins-geodev/lumen-calc](https://github.com/collins-geodev/lumen-calc)

Continuous deployment is enabled: every push to `main` deploys to Vercel.

## Features

- **Calc** — scientific keypad, Deg/Rad, memory, live preview
- **FX** — live currency conversion for 150+ currencies (searchable dropdowns)
- **Units** — length, mass, temperature, data, energy, and more
- **Code** — HEX / DEC / OCT / BIN with bitwise operations
- **AI** — local plain-English + advanced math: word problems (discount, budget, travel, recipes, interest), algebra (linear/quadratic/systems), calculus, trig, logs, sequences, combinatorics, stats, geometry, work-rate, and more — with step-by-step answers

## Stack

Vanilla HTML, CSS, and JavaScript. No build step required.

## Local development

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8765
```

Then visit `http://127.0.0.1:8765`.

## Deploy (Vercel)

This project is set up for continuous deployment from GitHub:

1. Push to `main` on this repository
2. Vercel builds and publishes automatically

Manual deploy (optional):

```bash
npx vercel --prod
```

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | App shell and mode panels |
| `styles.css` | Theme, layout, animations |
| `app.js` | Scientific calculator core |
| `currency.js` | Live FX rates |
| `units.js` | Unit converter |
| `programmer.js` | Programmer / bitwise mode |
| `ai.js` | Local AI math assist |
| `picker.js` | Searchable dark dropdowns |
| `data.js` | Currencies and unit tables |

## Android APK

An installable debug APK is built with Capacitor:

```bash
npm install
npm run apk
npm run apk:copy
```

The file lands at `dist/odogwu-calc.apk`.

**Install on your phone**

1. Copy `dist/odogwu-calc.apk` to your phone (USB, Drive, email, etc.).
2. On Android: Settings → Security (or Apps) → allow **Install unknown apps** for the app you use to open the file (Files, Chrome, Drive).
3. Open the APK and tap **Install**.

Notes:
- This is a debug build (fine for personal use; not Play Store release-signed).
- Builds need **JDK 21** and an Android SDK. If `java -version` shows 25+, set `JAVA_HOME` to a JDK 21 install before `npm run apk`.

## License

MIT
