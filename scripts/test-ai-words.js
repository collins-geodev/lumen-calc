const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "ai.js"), "utf8");
global.window = { LumenUnits: null, LumenUI: null };
// Node fetch exists in modern Node
eval(code.replace("window.LumenAI", "global.LumenAI"));

const cases = [
  ["discount", "A pair of shoes costs ₦25,000. A shop offers a 20% discount. How much will you pay after the discount?", /20000/],
  ["travel", "covering a distance of 120 km at an average speed of 60 km/h. How long will the journey take?", /2 hours/],
  ["compound", "Deposit ₦100,000 at 8% compound interest per year for 3 years. How much will you have?", /125971/],
  ["system", "solve 2x + 3y = 7; x - y = 1", /x = 2/],
  ["sin", "sin 30", /0\.5/],
  ["cot", "cot 45", /^1$/],
  ["prob", "probability of rolling a 6 on a die", /1\/6/],
  ["binomial", "binomial n=10 k=3 p=0.5", /0\.12/],
  ["limit", "limit as x→2 of x^2+1", /5/],
  ["critical", "critical points of x^3 - 3x", /local/],
  ["defint", "integrate x^2 from 0 to 3", /^9$/],
  ["fuel", "I bought fuel for 15,000 naira at 1,370 naira per liter. How many liters can I get?", /10\.95/],
];

(async () => {
  let failed = 0;
  for (const [name, q, re] of cases) {
    const r = await global.LumenAI.think(q);
    const ok = re.test(String(r.answer)) && !/couldn't/i.test(r.answer);
    if (!ok) {
      failed += 1;
      console.log("FAIL", name, "→", r.answer);
    } else {
      console.log("OK  ", name, "→", r.answer);
    }
  }

  // General knowledge (network)
  try {
    const g = await global.LumenAI.think("What is the capital of Nigeria?");
    const ok = /Abuja/i.test(g.answer);
    console.log(ok ? "OK  " : "FAIL", "general →", g.answer.slice(0, 120));
    if (!ok) failed += 1;
  } catch (e) {
    console.log("FAIL general", e.message);
    failed += 1;
  }

  process.exit(failed ? 1 : 0);
})();
