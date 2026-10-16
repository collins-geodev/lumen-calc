window.LumenAI = (() => {
  const gcd = (a, b) => {
    a = Math.abs(Math.trunc(a));
    b = Math.abs(Math.trunc(b));
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  };

  const lcm = (a, b) => Math.abs(Math.trunc(a) * Math.trunc(b)) / gcd(a, b);

  const factors = (n) => {
    n = Math.abs(Math.trunc(n));
    if (n < 2) return [n];
    const out = [];
    while (n % 2 === 0) {
      out.push(2);
      n /= 2;
    }
    for (let i = 3; i * i <= n; i += 2) {
      while (n % i === 0) {
        out.push(i);
        n /= i;
      }
    }
    if (n > 1) out.push(n);
    return out;
  };

  const evalSimple = (expr) => {
    const cleaned = expr
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/\^/g, "**")
      .replace(/[^0-9+\-*/().,%\s]/g, "");
    if (!cleaned.trim()) return null;
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict"; return (${cleaned});`)();
      return Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  };

  const parsePoly = (raw) => {
    // returns coeffs low->high for ax^2+bx+c style up to degree 6-ish
    let s = raw.replace(/\s+/g, "").replace(/−/g, "-").replace(/\*\*/g, "^");
    s = s.replace(/([0-9])x/gi, "$1*x").replace(/x\^/gi, "x^");
    const terms = s.match(/[+-]?[^+-]+/g) || [];
    const coeffs = {};
    for (let term of terms) {
      let sign = 1;
      if (term.startsWith("+")) term = term.slice(1);
      if (term.startsWith("-")) {
        sign = -1;
        term = term.slice(1);
      }
      if (!term) continue;
      if (term === "x") {
        coeffs[1] = (coeffs[1] || 0) + sign;
        continue;
      }
      const m = term.match(/^([0-9.]+)?\*?x(?:\^([0-9]+))?$/i);
      if (m) {
        const c = m[1] ? Number(m[1]) : 1;
        const p = m[2] ? Number(m[2]) : 1;
        coeffs[p] = (coeffs[p] || 0) + sign * c;
        continue;
      }
      if (/^[0-9.]+$/.test(term)) {
        coeffs[0] = (coeffs[0] || 0) + sign * Number(term);
      }
    }
    return coeffs;
  };

  const polyToString = (coeffs) => {
    const powers = Object.keys(coeffs)
      .map(Number)
      .filter((p) => coeffs[p])
      .sort((a, b) => b - a);
    if (!powers.length) return "0";
    return powers
      .map((p, i) => {
        const c = coeffs[p];
        const abs = Math.abs(c);
        const sign = c < 0 ? " − " : i === 0 ? "" : " + ";
        if (p === 0) return `${i === 0 && c < 0 ? "-" : sign}${abs}`;
        const coef = abs === 1 ? "" : String(abs);
        const body = p === 1 ? `${coef}x` : `${coef}x^${p}`;
        return `${i === 0 && c < 0 ? "-" : sign}${body}`;
      })
      .join("")
      .replace(/^\s\+\s/, "");
  };

  const derivative = (coeffs) => {
    const out = {};
    Object.keys(coeffs).forEach((p) => {
      const n = Number(p);
      if (n === 0) return;
      out[n - 1] = (out[n - 1] || 0) + coeffs[n] * n;
    });
    return out;
  };

  const integrate = (coeffs) => {
    const out = { 0: 0 };
    Object.keys(coeffs).forEach((p) => {
      const n = Number(p);
      out[n + 1] = (out[n + 1] || 0) + coeffs[n] / (n + 1);
    });
    return out;
  };

  const solveLinear = (q) => {
    const m = q.match(/solve\s+(.+?)\s*=\s*(.+)$/i) || q.match(/(.+?)\s*=\s*(.+)/);
    if (!m) return null;
    const left = m[1].replace(/solve/i, "").trim();
    const right = m[2].trim();
    // ax + b = c  or  ax + b = dx + e
    const move = `${left}-(${right})`;
    // Try pattern ax+b=c
    const simple = q.match(
      /(-?\d*\.?\d*)\s*\*?\s*x\s*([+-]\s*\d+\.?\d*)?\s*=\s*(-?\d+\.?\d*)/i
    );
    if (simple) {
      const a = simple[1] === "" || simple[1] === "+" ? 1 : simple[1] === "-" ? -1 : Number(simple[1]);
      const b = simple[2] ? Number(simple[2].replace(/\s/g, "")) : 0;
      const c = Number(simple[3]);
      if (a === 0) return null;
      const x = (c - b) / a;
      return {
        answer: `x = ${x}`,
        steps: [
          `Equation: ${a}x ${b >= 0 ? "+" : ""}${b} = ${c}`,
          `Subtract ${b}: ${a}x = ${c - b}`,
          `Divide by ${a}: x = ${x}`,
        ],
      };
    }
    // fallback evaluate if no x
    if (!/[xX]/.test(move)) {
      const v = evalSimple(left);
      const r = evalSimple(right);
      if (v !== null && r !== null) {
        return {
          answer: v === r ? "True" : "False",
          steps: [`Left = ${v}`, `Right = ${r}`],
        };
      }
    }
    return null;
  };

  const solveQuadratic = (q) => {
    const m =
      q.match(/quadratic\s+(.+?)(?:\s*=\s*0)?$/i) ||
      q.match(/(.*?x\^2.*?)\s*=\s*0/i) ||
      q.match(/(-?\d*)x\^2\s*([+-]\s*\d*)x\s*([+-]\s*\d+)\s*=\s*0/i);
    if (!m) return null;
    let expr = (m[1] || q).replace(/quadratic/i, "").replace(/=\s*0/, "").trim();
    const coeffs = parsePoly(expr);
    const a = coeffs[2] || 0;
    const b = coeffs[1] || 0;
    const c = coeffs[0] || 0;
    if (!a) return null;
    const d = b * b - 4 * a * c;
    const steps = [
      `Identified a=${a}, b=${b}, c=${c}`,
      `Discriminant Δ = b² − 4ac = ${d}`,
    ];
    if (d < 0) {
      const real = -b / (2 * a);
      const imag = Math.sqrt(-d) / (2 * a);
      steps.push("Δ < 0 → complex roots");
      return {
        answer: `x = ${real} ± ${imag}i`,
        steps,
      };
    }
    const r1 = (-b + Math.sqrt(d)) / (2 * a);
    const r2 = (-b - Math.sqrt(d)) / (2 * a);
    steps.push(`x = (−b ± √Δ) / 2a`);
    steps.push(`x₁ = ${r1}, x₂ = ${r2}`);
    return { answer: `x = ${r1} , ${r2}`, steps };
  };

  const parseLooseNumber = (s) => {
    if (s == null) return null;
    const n = Number(String(s).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };

  const formatQty = (n) => {
    if (!Number.isFinite(n)) return String(n);
    return String(Math.round(n * 100) / 100);
  };

  const unitLabel = (unit, qty) => {
    const u = String(unit || "unit").toLowerCase();
    const map = {
      liter: "liter",
      litre: "liter",
      l: "liter",
      kg: "kg",
      kilogram: "kg",
      kilograms: "kg",
      meter: "meter",
      metre: "meter",
      gallon: "gallon",
      gallons: "gallon",
      unit: "unit",
      units: "unit",
      item: "item",
      items: "item",
      piece: "piece",
      pieces: "piece",
    };
    const base = map[u] || u.replace(/s$/, "") || "unit";
    const plural = Math.abs(qty) === 1 ? base : base.endsWith("s") ? base : `${base}s`;
    return plural;
  };

  const moneyWord = "(?:naira|ngn|₦|\\$|usd|dollars?|euro|eur|£|pounds?|cedis?|ghs|kobo)";

  /** Word problems: total ÷ unit rate → quantity (e.g. fuel liters). */
  const solveUnitRateWord = (raw) => {
    const q = raw.replace(/\u00a0/g, " ");
    const flat = q.replace(/,/g, "");

    const rateM =
      flat.match(
        new RegExp(
          `(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?\\s*(?:per|\\/|a|each)\\s*(liter|litre|l|kg|kilograms?|meter|metre|gallon|unit|item|piece)s?`,
          "i"
        )
      ) ||
      flat.match(
        new RegExp(
          `(?:rate\\s+of|costs?|priced?\\s+at)\\s*(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?\\s*(?:per|\\/|a)\\s*(liter|litre|l|kg|kilograms?|meter|metre|gallon|unit|item|piece)s?`,
          "i"
        )
      );

    if (!rateM) return null;
    const rate = parseLooseNumber(rateM[1]);
    if (!rate) return null;
    const unit = rateM[2];

    const totalCandidates = [];
    const push = (n, why) => {
      const v = parseLooseNumber(n);
      if (v != null) totalCandidates.push({ v, why });
    };

    let m;
    m = flat.match(
      new RegExp(
        `(?:for\\s+the\\s+)?(?:price|cost|amount)\\s+of\\s*(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?`,
        "i"
      )
    );
    if (m) push(m[1], "price mentioned");

    m = flat.match(
      new RegExp(
        `bought\\s+(?:\\w+[\\s,]+)*?(?:for|at)\\s*(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}`,
        "i"
      )
    );
    if (m) push(m[1], "amount spent");

    m = flat.match(
      new RegExp(`(?:paid|spent|cost)\\s*(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}`, "i")
    );
    if (m) push(m[1], "amount paid");

    m = flat.match(
      new RegExp(`(?:fuel|gas|petrol|diesel|goods?)\\s+for\\s*(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}`, "i")
    );
    if (m) push(m[1], "purchase total");

    m = flat.match(new RegExp(`for\\s*(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}`, "i"));
    if (m) push(m[1], "stated total");

    // Prefer totals that differ from the unit rate
    const totals = totalCandidates.filter((t) => Math.abs(t.v - rate) > 1e-9);
    if (!totals.length) return null;
    // Prefer the largest monetary total (usual "how much can I get for X")
    totals.sort((a, b) => b.v - a.v);
    const total = totals[0].v;
    const why = totals[0].why;

    const qty = total / rate;
    const label = unitLabel(unit, qty);
    const qtyText = formatQty(qty);

    return {
      answer: `${qtyText} ${label}`,
      steps: [
        `Unit rate: ${formatQty(rate)} per ${unitLabel(unit, 1).replace(/s$/, "") || unit}`,
        `Total (${why}): ${formatQty(total)}`,
        `Quantity = total ÷ rate = ${formatQty(total)} ÷ ${formatQty(rate)}`,
        `= ${qtyText} ${label}`,
      ],
    };
  };

  /** How much does N units cost at rate R? */
  const solveCostWord = (raw) => {
    const flat = raw.replace(/,/g, "");
    const rateM = flat.match(
      new RegExp(
        `(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?\\s*(?:per|\\/|a)\\s*(liter|litre|l|kg|unit|item|piece)s?`,
        "i"
      )
    );
    const qtyM =
      flat.match(
        /(-?\d+(?:\.\d+)?)\s*(liter|litre|l|kg|kilograms?|gallon|unit|item|piece)s?\b/i
      ) ||
      flat.match(
        /(?:buy|need|get|want)\s*(-?\d+(?:\.\d+)?)\s*(liter|litre|l|kg|unit|item|piece)s?/i
      );
    if (!rateM || !qtyM) return null;
    if (!/how\s+much|cost|total|pay|price/i.test(flat)) return null;
    const rate = parseLooseNumber(rateM[1]);
    const qty = parseLooseNumber(qtyM[1]);
    if (!rate || qty == null) return null;
    if (Math.abs(rate - qty) < 1e-9) return null;
    const cost = rate * qty;
    return {
      answer: formatQty(cost),
      steps: [
        `Rate: ${formatQty(rate)} each`,
        `Quantity: ${formatQty(qty)} ${unitLabel(qtyM[2], qty)}`,
        `Cost = ${formatQty(rate)} × ${formatQty(qty)} = ${formatQty(cost)}`,
      ],
    };
  };

  const formatMoney = (n) => `₦${formatQty(n)}`;

  const allMoneyAmounts = (flat) => {
    const re = new RegExp(
      `(?:₦\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?|(?:₦\\s*)(-?\\d+(?:\\.\\d+)?)`,
      "gi"
    );
    const out = [];
    let m;
    while ((m = re.exec(flat))) {
      const v = parseLooseNumber(m[1] || m[2]);
      if (v != null) out.push(v);
    }
    return out;
  };

  /** Discount: price with % off → pay / savings. */
  const solveDiscountWord = (raw) => {
    const flat = raw.replace(/,/g, "").replace(/\u00a0/g, " ");
    if (!/discount|off|sale|promotional|markdown/i.test(flat)) return null;

    const pctM =
      flat.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:discount|off|markdown)/i) ||
      flat.match(/(?:discount|off|markdown)\s*(?:of\s*)?(-?\d+(?:\.\d+)?)\s*%/i) ||
      flat.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:during|in)\s*(?:a\s*)?(?:promotional\s*)?sale/i);
    if (!pctM) return null;
    const pct = parseLooseNumber(pctM[1]);
    if (pct == null) return null;

    const priceM =
      flat.match(
        new RegExp(
          `(?:costs?|price(?:d)?|priced\\s+at|worth|original\\s+price(?:\\s+of)?)\\s*(?:is\\s*)?(?:₦\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?`,
          "i"
        )
      ) ||
      flat.match(
        new RegExp(
          `(?:pair\\s+of\\s+\\w+|shoes|item|goods?|product)\\s+costs?\\s*(?:₦\\s*)?(-?\\d+(?:\\.\\d+)?)`,
          "i"
        )
      );
    let price = priceM ? parseLooseNumber(priceM[1]) : null;
    if (price == null) {
      const amounts = allMoneyAmounts(flat).filter((n) => n > 0 && n !== pct);
      if (amounts.length) price = Math.max(...amounts);
    }
    if (price == null || !price) return null;

    const discountAmt = (pct / 100) * price;
    const pay = price - discountAmt;
    const askSavings = /how\s+much\s+(?:is\s+)?(?:the\s+)?(?:discount|saved|save|off)/i.test(flat);

    if (askSavings) {
      return {
        answer: formatMoney(discountAmt),
        steps: [
          `Original price: ${formatMoney(price)}`,
          `Discount: ${pct}% of ${formatMoney(price)} = ${formatMoney(discountAmt)}`,
        ],
      };
    }

    return {
      answer: formatMoney(pay),
      steps: [
        `Original price: ${formatMoney(price)}`,
        `Discount: ${pct}% × ${formatMoney(price)} = ${formatMoney(discountAmt)}`,
        `Amount to pay = ${formatMoney(price)} − ${formatMoney(discountAmt)} = ${formatMoney(pay)}`,
      ],
    };
  };

  /** Budget: income − listed expenses → money left. */
  const solveBudgetWord = (raw) => {
    const flat = raw.replace(/,/g, "").replace(/\u00a0/g, " ");
    const incomeM = flat.match(
      new RegExp(
        `(?:salary|income|earn(?:s|ed)?|receive(?:s|d)?|budget|allowance|paycheck)\\s*(?:of\\s*|is\\s*|=\\s*)?(?:₦\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?`,
        "i"
      )
    );
    if (!incomeM) return null;
    if (
      !/spend|spent|expenses?|rent|food|transport|left|remain|balance|budget/i.test(flat)
    ) {
      return null;
    }

    const income = parseLooseNumber(incomeM[1]);
    if (income == null) return null;

    const expenses = [];
    const spendBlock = flat.match(
      /(?:spend|spent|expenses?|costs?)\s+(.+?)(?:\.|$|question:|how\s+much)/i
    );
    const scan = spendBlock ? spendBlock[1] : flat;
    const onRe = new RegExp(
      `(?:₦\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?\\s*on\\s+[\\w\\s]+`,
      "gi"
    );
    let m;
    while ((m = onRe.exec(scan))) {
      const v = parseLooseNumber(m[1]);
      if (v != null && Math.abs(v - income) > 1e-9) expenses.push(v);
    }
    if (!expenses.length) {
      const nums = [...scan.matchAll(/(?:₦\s*)?(-?\d+(?:\.\d+)?)/g)]
        .map((x) => parseLooseNumber(x[1]))
        .filter((v) => v != null && Math.abs(v - income) > 1e-9 && v < income * 2);
      // unique consecutive expense-like amounts from spend section
      for (const v of nums) {
        if (!expenses.includes(v)) expenses.push(v);
      }
    }
    if (!expenses.length) return null;

    const totalSpend = expenses.reduce((a, b) => a + b, 0);
    const left = income - totalSpend;
    return {
      answer: formatMoney(left),
      steps: [
        `Income: ${formatMoney(income)}`,
        `Expenses: ${expenses.map(formatMoney).join(" + ")} = ${formatMoney(totalSpend)}`,
        `Money left = ${formatMoney(income)} − ${formatMoney(totalSpend)} = ${formatMoney(left)}`,
      ],
    };
  };

  /** Speed / distance / time. */
  const solveMotionWord = (raw) => {
    const flat = raw
      .replace(/,/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[⁄／÷]/g, "/")
      .replace(/km\s*per\s*h(?:ou)?r/gi, "km/h")
      .replace(/kilomet(?:re|er)s?\s*per\s*h(?:ou)?r/gi, "km/h")
      .replace(/\s+/g, " ");

    // Prefer explicit "distance of N km" so "60 km/h" is not mistaken for distance
    const distM =
      flat.match(
        /distance\s+of\s+(-?\d+(?:\.\d+)?)\s*(km|kilometers?|kilometres?|miles?|m)\b/i
      ) ||
      flat.match(
        /(?:covering|covers?|drives?|drove)\s+(-?\d+(?:\.\d+)?)\s*(km|kilometers?|kilometres?|miles?|m)\b/i
      ) ||
      flat.match(/(-?\d+(?:\.\d+)?)\s*(km|kilometers?|kilometres?|miles?)\b(?!\s*\/\s*h)/i);
    const speedM =
      flat.match(
        /(?:an?\s+)?(?:average\s+)?speed\s+(?:of\s+|is\s+|at\s+)?(-?\d+(?:\.\d+)?)\s*(km\/h|kmh|kph|mph|m\/s)/i
      ) ||
      flat.match(/at\s+(-?\d+(?:\.\d+)?)\s*(km\/h|kmh|kph|mph)\b/i) ||
      flat.match(/(-?\d+(?:\.\d+)?)\s*(km\/h|kmh|kph|mph)\b/i);
    const timeM =
      flat.match(
        /(?:takes?|took|in|for|after)\s*(-?\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/i
      ) ||
      flat.match(/(-?\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);

    const toHours = (val, unit) => {
      const u = unit.toLowerCase();
      if (/min/.test(u)) return val / 60;
      if (/sec/.test(u)) return val / 3600;
      return val;
    };
    const fromHours = (hours) => {
      if (Math.abs(hours - Math.round(hours)) < 1e-9) {
        const h = Math.round(hours);
        return { text: `${h} ${h === 1 ? "hour" : "hours"}`, hours: h };
      }
      if (hours < 1) {
        const mins = Math.round(hours * 60 * 100) / 100;
        return { text: `${formatQty(mins)} minutes`, hours };
      }
      const h = Math.floor(hours);
      const mins = Math.round((hours - h) * 60);
      if (mins === 0) return { text: `${h} ${h === 1 ? "hour" : "hours"}`, hours };
      return {
        text: `${h} ${h === 1 ? "hour" : "hours"} ${mins} minutes`,
        hours,
      };
    };

    const dist = distM ? parseLooseNumber(distM[1]) : null;
    const distUnit = distM ? distM[2] : "km";
    const speed = speedM ? parseLooseNumber(speedM[1]) : null;
    const speedUnit = speedM ? speedM[2] : "km/h";

    // Time from distance & speed
    if (
      dist != null &&
      speed != null &&
      speed !== 0 &&
      /how\s+long|how\s+many\s+hours?|time|duration|journey\s+take/i.test(flat)
    ) {
      const hours = dist / speed;
      const pretty = fromHours(hours);
      return {
        answer: pretty.text,
        steps: [
          `Distance = ${formatQty(dist)} ${distUnit}`,
          `Speed = ${formatQty(speed)} ${speedUnit}`,
          `Time = distance ÷ speed = ${formatQty(dist)} ÷ ${formatQty(speed)}`,
          `= ${formatQty(hours)} hours` +
            (pretty.text.includes("hour") && !pretty.text.startsWith(String(hours))
              ? ` (${pretty.text})`
              : ""),
        ],
      };
    }

    // Distance from speed & time
    if (speed != null && timeM && /how\s+far|what\s+distance|distance/i.test(flat)) {
      const t = toHours(parseLooseNumber(timeM[1]), timeM[2]);
      const d = speed * t;
      return {
        answer: `${formatQty(d)} ${distUnit || "km"}`,
        steps: [
          `Speed = ${formatQty(speed)} ${speedUnit}`,
          `Time = ${formatQty(t)} hours`,
          `Distance = speed × time = ${formatQty(d)} ${distUnit || "km"}`,
        ],
      };
    }

    // Speed from distance & time
    if (dist != null && timeM && /how\s+fast|what\s+speed|average\s+speed/i.test(flat)) {
      const t = toHours(parseLooseNumber(timeM[1]), timeM[2]);
      if (!t) return null;
      const s = dist / t;
      return {
        answer: `${formatQty(s)} ${speedUnit || "km/h"}`,
        steps: [
          `Distance = ${formatQty(dist)} ${distUnit}`,
          `Time = ${formatQty(t)} hours`,
          `Speed = distance ÷ time = ${formatQty(s)} ${speedUnit || "km/h"}`,
        ],
      };
    }

    return null;
  };

  /** Proportions / recipe scaling. */
  const solveProportionWord = (raw) => {
    const flat = raw.replace(/,/g, "").replace(/\u00a0/g, " ");
    const base =
      flat.match(
        /(-?\d+(?:\.\d+)?)\s*(cups?|kg|g|liters?|litres?|ml|spoons?|tablespoons?|teaspoons?|pieces?|units?)\s+(?:of\s+\w+\s+)?(?:to\s+)?(?:prepare|serve|feed|for|makes?)\s*(?:food\s+for\s*|meal\s+for\s*)?(-?\d+(?:\.\d+)?)\s*(people|persons?|guests?|servings?)/i
      ) ||
      flat.match(
        /(-?\d+(?:\.\d+)?)\s*(cups?|kg|g|liters?|litres?|ml)\s+(?:of\s+)?\w+\s+for\s+(-?\d+(?:\.\d+)?)\s*(people|persons?|guests?|servings?)/i
      );
    const target = flat.match(
      /(?:for|to\s+(?:prepare|serve|feed)|need(?:ed)?\s+for)\s*(?:the\s+same\s+meal\s+for\s*)?(-?\d+(?:\.\d+)?)\s*(people|persons?|guests?|servings?)/gi
    );

    if (!base) return null;
    const amount = parseLooseNumber(base[1]);
    const unit = base[2];
    const peopleA = parseLooseNumber(base[3]);
    if (amount == null || !peopleA) return null;

    // Find the "for N people" that is NOT the base serving size
    let peopleB = null;
    const peopleMatches = [
      ...flat.matchAll(
        /(?:for|feed|serve)\s*(?:the\s+same\s+meal\s+for\s*)?(-?\d+(?:\.\d+)?)\s*(people|persons?|guests?|servings?)/gi
      ),
    ];
    for (const pm of peopleMatches) {
      const n = parseLooseNumber(pm[1]);
      if (n != null && Math.abs(n - peopleA) > 1e-9) {
        peopleB = n;
      }
    }
    // Also: "how many ... for 10 people"
    if (peopleB == null) {
      const hm = flat.match(
        /how\s+many\s+\w+\s+.*?(?:for|to\s+feed)\s*(-?\d+(?:\.\d+)?)\s*(people|persons?|guests?)/i
      );
      if (hm) peopleB = parseLooseNumber(hm[1]);
    }
    if (peopleB == null && target && target.length) {
      const last = [...flat.matchAll(/(-?\d+(?:\.\d+)?)\s*(people|persons?|guests?)/gi)];
      const nums = last.map((x) => parseLooseNumber(x[1])).filter((n) => n != null);
      peopleB = nums.find((n) => Math.abs(n - peopleA) > 1e-9) ?? null;
    }
    if (peopleB == null) return null;

    const need = amount * (peopleB / peopleA);
    const u = unit.replace(/s$/i, "");
    const label = Math.abs(need) === 1 ? u : `${u}s`;
    return {
      answer: `${formatQty(need)} ${label}`,
      steps: [
        `Base recipe: ${formatQty(amount)} ${label} for ${formatQty(peopleA)} people`,
        `Scale factor = ${formatQty(peopleB)} ÷ ${formatQty(peopleA)} = ${formatQty(peopleB / peopleA)}`,
        `Needed = ${formatQty(amount)} × ${formatQty(peopleB / peopleA)} = ${formatQty(need)} ${label}`,
      ],
    };
  };

  /** Simple interest: A = P(1 + rt). */
  const solveSimpleInterestWord = (raw) => {
    const flat = raw.replace(/,/g, "").replace(/\u00a0/g, " ");
    if (!/interest|deposit|savings?\s+account|principal/i.test(flat)) return null;
    if (/compound/i.test(flat)) return null;

    const principalM =
      flat.match(
        new RegExp(
          `(?:deposit|invest|principal|put|save[sd]?)\\s*(?:of\\s*|is\\s*)?(?:₦\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?`,
          "i"
        )
      ) ||
      flat.match(
        new RegExp(
          `(?:₦\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?\\s+into\\s+(?:a\\s+)?(?:savings?|bank)`,
          "i"
        )
      );
    const rateM =
      flat.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:simple\s*)?interest/i) ||
      flat.match(/(?:pays?|rate\s+of|at)\s*(-?\d+(?:\.\d+)?)\s*%/i) ||
      flat.match(/(-?\d+(?:\.\d+)?)\s*%\s*per\s*year/i);
    const timeM =
      flat.match(
        /(?:after|for|in)\s*(-?\d+(?:\.\d+)?)\s*(years?|yrs?|months?|days?)/i
      ) ||
      flat.match(/(-?\d+(?:\.\d+)?)\s*(years?|yrs?)\b/i);

    if (!principalM || !rateM || !timeM) return null;
    const P = parseLooseNumber(principalM[1]);
    const rPct = parseLooseNumber(rateM[1]);
    let t = parseLooseNumber(timeM[1]);
    const tUnit = timeM[2].toLowerCase();
    if (P == null || rPct == null || t == null) return null;

    if (/month/.test(tUnit)) t = t / 12;
    else if (/day/.test(tUnit)) t = t / 365;

    const r = rPct / 100;
    const interest = P * r * t;
    const amount = P + interest;
    const askInterestOnly =
      /how\s+much\s+interest|interest\s+(?:earned|gained|will\s+you\s+earn)/i.test(flat);

    if (askInterestOnly) {
      return {
        answer: formatMoney(interest),
        steps: [
          `Principal P = ${formatMoney(P)}`,
          `Rate r = ${formatQty(rPct)}% = ${formatQty(r)} per year`,
          `Time t = ${formatQty(t)} years`,
          `Simple interest I = P × r × t = ${formatMoney(interest)}`,
        ],
      };
    }

    return {
      answer: formatMoney(amount),
      steps: [
        `Principal P = ${formatMoney(P)}`,
        `Rate r = ${formatQty(rPct)}% per year`,
        `Time t = ${formatQty(t)} years`,
        `Interest I = P × r × t = ${formatMoney(P)} × ${formatQty(r)} × ${formatQty(t)} = ${formatMoney(interest)}`,
        `Amount A = P + I = ${formatMoney(P)} + ${formatMoney(interest)} = ${formatMoney(amount)}`,
      ],
    };
  };

  const think = (raw) => {
    const q = raw.trim();
    if (!q) {
      return { answer: "Ask a math question first", steps: [] };
    }

    const temp = window.LumenUnits?.answerTempPrompt?.(q);
    if (temp) return temp;

    const discount = solveDiscountWord(q);
    if (discount) return discount;

    const interest = solveSimpleInterestWord(q);
    if (interest) return interest;

    const budget = solveBudgetWord(q);
    if (budget) return budget;

    const motion = solveMotionWord(q);
    if (motion) return motion;

    const proportion = solveProportionWord(q);
    if (proportion) return proportion;

    const unitRate = solveUnitRateWord(q);
    if (unitRate) return unitRate;

    const costWord = solveCostWord(q);
    if (costWord) return costWord;

    let m = q.match(/(?:derivative|differentiate|d\/dx)\s+(?:of\s+)?(.+)/i);
    if (m) {
      const coeffs = parsePoly(m[1]);
      const d = derivative(coeffs);
      return {
        answer: polyToString(d),
        steps: [`f(x) = ${polyToString(coeffs)}`, "Power rule: d/dx[xⁿ] = n·xⁿ⁻¹", `f'(x) = ${polyToString(d)}`],
      };
    }

    m = q.match(/(?:integrate|integral|∫)\s+(?:of\s+)?(.+?)(?:\s*dx)?$/i);
    if (m) {
      const coeffs = parsePoly(m[1]);
      const F = integrate(coeffs);
      return {
        answer: polyToString(F) + " + C",
        steps: [
          `f(x) = ${polyToString(coeffs)}`,
          "∫ xⁿ dx = xⁿ⁺¹/(n+1) + C",
          `∫ f(x) dx = ${polyToString(F)} + C`,
        ],
      };
    }

    m = q.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:of|off)?\s*(-?\d+(?:\.\d+)?)/i);
    if (m) {
      const pct = Number(m[1]);
      const base = Number(m[2]);
      const v = (pct / 100) * base;
      return {
        answer: String(v),
        steps: [`${pct}% = ${pct / 100}`, `${pct / 100} × ${base} = ${v}`],
      };
    }

    m = q.match(/gcd\s*(?:of\s*)?(-?\d+)\s*(?:and|,)\s*(-?\d+)/i);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const g = gcd(a, b);
      return { answer: String(g), steps: [`Euclidean algorithm on ${a} and ${b}`, `gcd = ${g}`] };
    }

    m = q.match(/lcm\s*(?:of\s*)?(-?\d+)\s*(?:and|,)\s*(-?\d+)/i);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const l = lcm(a, b);
      return { answer: String(l), steps: [`lcm(a,b) = |ab|/gcd`, `lcm(${a},${b}) = ${l}`] };
    }

    m = q.match(/(?:prime\s*)?factors?\s*(?:of\s*)?(-?\d+)/i);
    if (m) {
      const n = Number(m[1]);
      const f = factors(n);
      return {
        answer: f.join(" × "),
        steps: [`Prime factorization of ${n}`, f.join(" × ")],
      };
    }

    m = q.match(/sqrt(?:\s*of)?\s*(-?\d+(?:\.\d+)?)/i);
    if (m) {
      const n = Number(m[1]);
      if (n < 0) return { answer: `${Math.sqrt(-n)}i`, steps: ["Negative under root → imaginary"] };
      return { answer: String(Math.sqrt(n)), steps: [`√${n}`] };
    }

    const quad = solveQuadratic(q);
    if (quad) return quad;

    if (/solve|x\s*=|=/.test(q) && /x/i.test(q)) {
      const lin = solveLinear(q);
      if (lin) return lin;
    }

    // arithmetic phrase: what is 2+2
    m = q.match(/(?:what\s+is|calculate|compute|eval(?:uate)?)\s+(.+)/i);
    if (m) {
      const v = evalSimple(m[1]);
      if (v !== null) return { answer: String(v), steps: [`Evaluated ${m[1]}`, `= ${v}`] };
    }

    const direct = evalSimple(q);
    if (direct !== null) {
      return { answer: String(direct), steps: ["Parsed as arithmetic expression", `= ${direct}`] };
    }

    return {
      answer: "I couldn't parse that yet",
      steps: [
        "Try: shoes cost ₦25000 with 20% discount — how much to pay?",
        "salary ₦180000 spend on food/rent… — how much left?",
        "120 km at 60 km/h — how long? · 3 cups for 6 people → for 10?",
        "₦100000 at 8% simple interest for 3 years — total?",
        "fuel for 15000 at 1370/liter · solve 2x+5=17 · 15% of 240",
      ],
    };
  };

  const render = (result) => {
    document.getElementById("aiAnswer").textContent = result.answer;
    const steps = document.getElementById("aiSteps");
    steps.innerHTML = (result.steps || [])
      .map((s, i) => `<div class="ai-step"><span>${i + 1}</span><p>${s}</p></div>`)
      .join("");
  };

  const ask = () => {
    const q = document.getElementById("aiInput").value;
    const result = think(q);
    render(result);
    window.LumenUI?.toast?.("Thought complete");
  };

  const init = () => {
    document.getElementById("aiAskBtn").addEventListener("click", ask);
    document.getElementById("aiClearBtn").addEventListener("click", () => {
      document.getElementById("aiInput").value = "";
      render({ answer: "Ask anything math-shaped", steps: [] });
    });
    document.getElementById("aiChips").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-prompt]");
      if (!btn) return;
      document.getElementById("aiInput").value = btn.dataset.prompt;
      ask();
    });
    document.getElementById("aiInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        ask();
      }
    });
  };

  const copyValue = () => document.getElementById("aiAnswer").textContent;

  return { init, ask, think, copyValue };
})();
