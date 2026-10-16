# Lumen — Smart Omni Calculator

A dark, glassmorphic calculator with scientific tools, live FX, units conversion, programmer mode, and local AI math assist.

**Live app:** [https://lumen-calc-iota.vercel.app](https://lumen-calc-iota.vercel.app)

## Features

- **Calc** — scientific keypad, Deg/Rad, memory, live preview
- **FX** — live currency conversion for 150+ currencies (searchable dropdowns)
- **Units** — length, mass, temperature, data, energy, and more
- **Code** — HEX / DEC / OCT / BIN with bitwise operations
- **AI** — plain-English math with step-by-step answers (runs locally in the browser)

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

## License

MIT
