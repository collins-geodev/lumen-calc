const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "ai.js"), "utf8");
global.window = { LumenUnits: null, LumenUI: null };
eval(code.replace("window.LumenAI", "global.LumenAI"));

const cases = [
  ["discount", "A pair of shoes costs ₦25,000. A shop offers a 20% discount. How much will you pay after the discount?", /20000/],
  ["budget", "salary of ₦180,000. spend ₦45,000 on food, ₦30,000 on transportation, ₦50,000 on rent, and ₦15,000 on other. How much left?", /40000/],
  ["travel", "covering a distance of 120 km at an average speed of 60 km/h. How long will the journey take?", /2 hours/],
  ["recipe", "3 cups of rice for 6 people. How many cups for 10 people?", /5 cups/],
  ["simple", "deposit ₦100,000 that pays 8% simple interest per year. How much after 3 years?", /124000/],
  ["compound", "Deposit ₦100,000 at 8% compound interest per year for 3 years. How much will you have?", /125971/],
  ["system", "solve 2x + 3y = 7; x - y = 1", /x = 2.*y = 1|x = 2, y = 1/],
  ["quad", "quadratic x^2 - 5x + 6 = 0", /2|3/],
  ["deriv", "derivative of 3x^4 - 2x", /12x\^3/],
  ["defint", "integrate x^2 from 0 to 3", /^9$/],
  ["ap", "AP: a = 3, d = 5, n = 10 find term", /48/],
  ["mean", "mean of 2, 5, 8, 11, 14", /8/],
  ["ncr", "10 choose 3", /120/],
  ["sin", "sin 30", /0\.5/],
  ["log", "log base 2 of 8", /3/],
  ["circle", "area of a circle with radius 7", /153\.9/],
  ["pyth", "Pythagoras legs 3 and 4 find hypotenuse", /5/],
  ["work", "A can finish a job in 6 hours and B in 3 hours. How long together?", /2 hours/],
  ["fuel", "I bought fuel for 15,000 naira at 1,370 naira per liter. How many liters can I get?", /10\.95/],
  ["exp", "2^x = 32", /x = 5/],
];

let failed = 0;
for (const [name, q, re] of cases) {
  const r = global.LumenAI.think(q);
  const ok = re.test(String(r.answer)) && !/couldn't parse/i.test(r.answer);
  if (!ok) {
    failed += 1;
    console.log("FAIL", name, "→", r.answer);
  } else {
    console.log("OK  ", name, "→", r.answer);
  }
}
process.exit(failed ? 1 : 0);
