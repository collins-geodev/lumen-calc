const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "ai.js"), "utf8");
global.window = { LumenUnits: null, LumenUI: null };
eval(code.replace("window.LumenAI", "global.LumenAI"));

const qs = [
  "A pair of shoes costs ₦25,000. A shop offers a 20% discount during a promotional sale. Question: How much will you pay for the shoes after the discount?",
  "You receive a monthly salary of ₦180,000. You spend ₦45,000 on food, ₦30,000 on transportation, ₦50,000 on rent, and ₦15,000 on other expenses. Question: How much money will you have left at the end of the month?",
  "A driver travels from Lagos to Ibadan, covering a distance of 120 km at an average speed of 60 km/h. How long will the journey take if the driver maintains the same speed throughout?",
  "A driver travels from Lagos to Ibadan, covering a distance of 120 km at an average speed of 60 km/h. Question: How long will the journey take if the driver maintains the same speed throughout?",
  "A recipe requires 3 cups of rice to prepare food for 6 people. Question: How many cups of rice will you need to prepare the same meal for 10 people?",
  "You deposit ₦100,000 into a savings account that pays 8% simple interest per year. Question: How much money will you have in your account after 3 years, assuming you make no withdrawals?",
];

let failed = 0;
for (const q of qs) {
  const r = global.LumenAI.think(q);
  const bad = /couldn't parse/i.test(r.answer);
  if (bad) failed += 1;
  console.log(bad ? "FAIL" : "OK ", r.answer);
}
process.exit(failed ? 1 : 0);
