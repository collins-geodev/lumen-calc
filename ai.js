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

  /** Safe math evaluator: trig, logs, roots, factorial, constants. */
  const evalMath = (expr) => {
    if (!expr || typeof expr !== "string") return null;
    let s = expr
      .trim()
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/π|pi/gi, "PI")
      .replace(/\be\b/g, "E")
      .replace(/\^/g, "**")
      .replace(/√\s*\(/g, "sqrt(")
      .replace(/√\s*(-?\d+(?:\.\d+)?)/g, "sqrt($1)")
      .replace(/(\d+(?:\.\d+)?)\s*!/g, "factorial($1)")
      .replace(/\bln\s*\(/gi, "log(")
      .replace(/\blog10\s*\(/gi, "log10(");
    // sin30 → sin(30) when followed by number
    s = s.replace(
      /\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|sqrt|abs|floor|ceil|round|exp|log|log10|log2)\s*(-?\d+(?:\.\d+)?)/gi,
      "$1($2)"
    );
    const probe = s
      .replace(
        /\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|sqrt|abs|floor|ceil|round|exp|log|log10|log2|factorial|sind|cosd|tand|PI|E|Math)\b/gi,
        ""
      )
      .replace(/[0-9+\-*/().,%\s_]/g, "");
    if (probe.length) return null;
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(
        `"use strict";
        const {sin,cos,tan,asin,acos,atan,sinh,cosh,tanh,sqrt,abs,floor,ceil,round,exp,log,log10,log2,PI,E} = Math;
        const factorial = (n) => {
          n = Math.trunc(n);
          if (n < 0 || n > 170) return NaN;
          let r = 1;
          for (let i = 2; i <= n; i++) r *= i;
          return r;
        };
        // degrees for trig of bare numbers often expected — use radians; wrap deg helpers
        const sind = (d) => sin(d * PI / 180);
        const cosd = (d) => cos(d * PI / 180);
        const tand = (d) => tan(d * PI / 180);
        return (${s});`
      )();
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

  const solveCompoundInterestWord = (raw) => {
    const flat = raw.replace(/,/g, "").replace(/\u00a0/g, " ");
    if (!/compound/i.test(flat)) return null;
    const principalM =
      flat.match(
        new RegExp(
          `(?:deposit|invest|principal|put|save[sd]?)\\s*(?:of\\s*|is\\s*)?(?:₦\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?`,
          "i"
        )
      ) ||
      flat.match(
        new RegExp(`(?:₦\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*${moneyWord}?\\s+into`, "i")
      );
    const rateM =
      flat.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:compound|per\s*year|annual|interest)/i) ||
      flat.match(/(?:rate|pays?|at)\s*(-?\d+(?:\.\d+)?)\s*%/i);
    const timeM = flat.match(/(?:after|for|in)\s*(-?\d+(?:\.\d+)?)\s*(years?|yrs?|months?)/i);
    if (!principalM || !rateM || !timeM) return null;
    const P = parseLooseNumber(principalM[1]);
    const rPct = parseLooseNumber(rateM[1]);
    let t = parseLooseNumber(timeM[1]);
    if (P == null || rPct == null || t == null) return null;
    if (/month/.test(timeM[2])) t /= 12;
    let n = 1;
    if (/monthly|compounded\s+monthly/i.test(flat)) n = 12;
    else if (/quarterly/i.test(flat)) n = 4;
    else if (/daily/i.test(flat)) n = 365;
    else if (/semi[- ]?annual|twice\s+a\s+year/i.test(flat)) n = 2;
    const r = rPct / 100;
    const A = P * (1 + r / n) ** (n * t);
    const interest = A - P;
    return {
      answer: formatMoney(A),
      steps: [
        `Compound interest: A = P(1 + r/n)^(nt)`,
        `P = ${formatMoney(P)}, r = ${formatQty(rPct)}%, n = ${n}/year, t = ${formatQty(t)} years`,
        `A = ${formatMoney(P)} × (1 + ${formatQty(r)}/${n})^(${n}×${formatQty(t)}) = ${formatMoney(A)}`,
        `Interest earned = ${formatMoney(interest)}`,
      ],
    };
  };

  const solvePercentChangeWord = (raw) => {
    const flat = raw.replace(/,/g, "");
    const m =
      flat.match(
        /(?:increase[sd]?|raised?|grew|grow)\s*(?:by\s*)?(-?\d+(?:\.\d+)?)\s*%\s*(?:from|of)?\s*(?:₦\s*)?(-?\d+(?:\.\d+)?)/i
      ) ||
      flat.match(
        /(-?\d+(?:\.\d+)?)\s*%\s*(?:increase|rise|markup|vat|tax)\s*(?:on|of|from)?\s*(?:₦\s*)?(-?\d+(?:\.\d+)?)/i
      );
    const dec =
      flat.match(
        /(?:decrease[sd]?|reduce[sd]?|drop(?:ped)?|fell)\s*(?:by\s*)?(-?\d+(?:\.\d+)?)\s*%\s*(?:from|of)?\s*(?:₦\s*)?(-?\d+(?:\.\d+)?)/i
      ) ||
      flat.match(
        /(-?\d+(?:\.\d+)?)\s*%\s*(?:decrease|reduction|markdown)\s*(?:on|of|from)?\s*(?:₦\s*)?(-?\d+(?:\.\d+)?)/i
      );
    if (m) {
      const pct = parseLooseNumber(m[1]);
      const base = parseLooseNumber(m[2]);
      const v = base * (1 + pct / 100);
      return {
        answer: formatQty(v),
        steps: [
          `Increase ${formatQty(pct)}% of ${formatQty(base)}`,
          `New = ${formatQty(base)} × (1 + ${formatQty(pct / 100)}) = ${formatQty(v)}`,
        ],
      };
    }
    if (dec) {
      const pct = parseLooseNumber(dec[1]);
      const base = parseLooseNumber(dec[2]);
      const v = base * (1 - pct / 100);
      return {
        answer: formatQty(v),
        steps: [
          `Decrease ${formatQty(pct)}% of ${formatQty(base)}`,
          `New = ${formatQty(base)} × (1 − ${formatQty(pct / 100)}) = ${formatQty(v)}`,
        ],
      };
    }
    const fromTo = flat.match(
      /(?:percent(?:age)?\s*(?:change|increase|decrease)|%?\s*change)\s*(?:from\s*)?(-?\d+(?:\.\d+)?)\s*(?:to|→)\s*(-?\d+(?:\.\d+)?)/i
    );
    if (fromTo) {
      const a = parseLooseNumber(fromTo[1]);
      const b = parseLooseNumber(fromTo[2]);
      if (!a) return null;
      const pct = ((b - a) / a) * 100;
      return {
        answer: `${formatQty(pct)}%`,
        steps: [
          `Percent change = (new − old) / old × 100`,
          `(${formatQty(b)} − ${formatQty(a)}) / ${formatQty(a)} × 100 = ${formatQty(pct)}%`,
        ],
      };
    }
    return null;
  };

  const parseLinEq = (eq) => {
    // ax + by = c  (also ay + bx)
    let s = eq.replace(/\s+/g, "").replace(/−/g, "-");
    const sides = s.split("=");
    if (sides.length !== 2) return null;
    const parseSide = (side, sign) => {
      const coeffs = { x: 0, y: 0, c: 0 };
      const terms = side.match(/[+-]?[^+-]+/g) || [];
      for (let term of terms) {
        let sg = sign;
        if (term.startsWith("+")) term = term.slice(1);
        if (term.startsWith("-")) {
          sg *= -1;
          term = term.slice(1);
        }
        if (!term) continue;
        if (/^\d*\.?\d*x$/i.test(term)) {
          const n = term.slice(0, -1);
          coeffs.x += sg * (n === "" ? 1 : Number(n));
        } else if (/^\d*\.?\d*y$/i.test(term)) {
          const n = term.slice(0, -1);
          coeffs.y += sg * (n === "" ? 1 : Number(n));
        } else if (/^\d+\.?\d*$/.test(term)) {
          coeffs.c += sg * Number(term);
        }
      }
      return coeffs;
    };
    const L = parseSide(sides[0], 1);
    const R = parseSide(sides[1], -1);
    return {
      a: L.x + R.x,
      b: L.y + R.y,
      c: -(L.c + R.c),
    };
  };

  const solveSystem2 = (raw) => {
    const flat = raw.replace(/\u00a0/g, " ");
    if (!/\by\b/i.test(flat) || !/\bx\b/i.test(flat)) return null;
    const eqs = flat.match(/[^;\n]+?=[^;\n]+/g);
    if (!eqs || eqs.length < 2) return null;
    const cleaned = eqs
      .map((e) => e.replace(/solve|system|equations?|and/gi, "").trim())
      .filter((e) => /[xy]/i.test(e) && /=/.test(e));
    if (cleaned.length < 2) return null;
    const e1 = parseLinEq(cleaned[0]);
    const e2 = parseLinEq(cleaned[1]);
    if (!e1 || !e2) return null;
    const { a: a1, b: b1, c: c1 } = e1;
    const { a: a2, b: b2, c: c2 } = e2;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-12) {
      return { answer: "No unique solution (parallel or identical lines)", steps: [`Determinant = ${det}`] };
    }
    const x = (c1 * b2 - c2 * b1) / det;
    const y = (a1 * c2 - a2 * c1) / det;
    return {
      answer: `x = ${formatQty(x)}, y = ${formatQty(y)}`,
      steps: [
        `Eq1: ${formatQty(a1)}x + ${formatQty(b1)}y = ${formatQty(c1)}`,
        `Eq2: ${formatQty(a2)}x + ${formatQty(b2)}y = ${formatQty(c2)}`,
        `Solved by elimination/Cramer's rule (Δ = ${formatQty(det)})`,
        `x = ${formatQty(x)}, y = ${formatQty(y)}`,
      ],
    };
  };

  const solveTrig = (raw) => {
    const flat = raw.replace(/\u00a0/g, " ");

    // Degree ↔ radian conversion
    let m = flat.match(/convert\s+(-?\d+(?:\.\d+)?)\s*(?:°|degrees?)\s+to\s+rad/i);
    if (m) {
      const deg = Number(m[1]);
      const rad = (deg * Math.PI) / 180;
      return {
        answer: `${formatQty(rad)} rad`,
        steps: [`radians = degrees × π/180`, `${deg}° = ${formatQty(rad)} rad`],
      };
    }
    m = flat.match(/convert\s+(-?\d+(?:\.\d+)?)\s*(?:rad(?:ians?)?)\s+to\s+deg/i);
    if (m) {
      const rad = Number(m[1]);
      const deg = (rad * 180) / Math.PI;
      return {
        answer: `${formatQty(deg)}°`,
        steps: [`degrees = radians × 180/π`, `${rad} rad = ${formatQty(deg)}°`],
      };
    }

    // Law of cosines: c² = a²+b²−2ab cosC
    m = flat.match(
      /law\s+of\s+cosines.*?a\s*=\s*(-?\d+(?:\.\d+)?).*?b\s*=\s*(-?\d+(?:\.\d+)?).*?(?:angle\s*[Cc]|C)\s*=\s*(-?\d+(?:\.\d+)?)/i
    );
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const C = Number(m[3]);
      const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos((C * Math.PI) / 180));
      return {
        answer: formatQty(c),
        steps: [
          `c² = a² + b² − 2ab cos(C)`,
          `c = √(${a}² + ${b}² − 2·${a}·${b}·cos(${C}°)) = ${formatQty(c)}`,
        ],
      };
    }

    // Law of sines: a/sinA = b/sinB
    m = flat.match(
      /law\s+of\s+sines.*?a\s*=\s*(-?\d+(?:\.\d+)?).*?A\s*=\s*(-?\d+(?:\.\d+)?).*?B\s*=\s*(-?\d+(?:\.\d+)?)/i
    );
    if (m) {
      const a = Number(m[1]);
      const A = Number(m[2]);
      const B = Number(m[3]);
      const b = (a * Math.sin((B * Math.PI) / 180)) / Math.sin((A * Math.PI) / 180);
      return {
        answer: formatQty(b),
        steps: [
          `a/sin(A) = b/sin(B)`,
          `b = a · sin(B)/sin(A) = ${formatQty(b)}`,
        ],
      };
    }

    // sin/cos/tan/cot/sec/csc of angle in degrees
    m = flat.match(
      /\b(sin|cos|tan|cot|sec|csc)\s*(?:of\s*)?(-?\d+(?:\.\d+)?)\s*(?:°|degrees?)?/i
    );
    if (m && !/[xy=]/i.test(flat.split(m[0])[0]?.slice(-5) || "")) {
      const fn = m[1].toLowerCase();
      const deg = parseLooseNumber(m[2]);
      const rad = (deg * Math.PI) / 180;
      const s = Math.sin(rad);
      const c = Math.cos(rad);
      const t = Math.tan(rad);
      const map = {
        sin: s,
        cos: c,
        tan: t,
        cot: 1 / t,
        sec: 1 / c,
        csc: 1 / s,
      };
      const v = map[fn];
      return {
        answer: formatQty(Math.round(v * 1e10) / 1e10),
        steps: [`${fn}(${formatQty(deg)}°) in degrees`, `= ${formatQty(v)}`],
      };
    }
    // right triangle: opposite/adjacent/hypotenuse
    const opp = flat.match(/opposite\s*(?:side\s*)?(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i);
    const adj = flat.match(/adjacent\s*(?:side\s*)?(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i);
    const hyp = flat.match(/hypotenuse\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i);
    const ang = flat.match(/angle\s*(?:is\s*|=\s*|of\s*)?(-?\d+(?:\.\d+)?)\s*(?:°|degrees?)?/i);
    if (ang && (opp || adj || hyp)) {
      const A = parseLooseNumber(ang[1]);
      const rad = (A * Math.PI) / 180;
      if (opp && /find\s*(?:the\s*)?hypotenuse|hypotenuse/i.test(flat) && !hyp) {
        const o = parseLooseNumber(opp[1]);
        const h = o / Math.sin(rad);
        return {
          answer: formatQty(h),
          steps: [`sin(A) = opposite / hypotenuse`, `hypotenuse = ${formatQty(o)} / sin(${A}°) = ${formatQty(h)}`],
        };
      }
      if (adj && /find\s*(?:the\s*)?hypotenuse|hypotenuse/i.test(flat) && !hyp) {
        const a = parseLooseNumber(adj[1]);
        const h = a / Math.cos(rad);
        return {
          answer: formatQty(h),
          steps: [`cos(A) = adjacent / hypotenuse`, `hypotenuse = ${formatQty(a)} / cos(${A}°) = ${formatQty(h)}`],
        };
      }
      if (opp && adj && /find\s*(?:the\s*)?angle|what\s+is\s+the\s+angle/i.test(flat)) {
        const o = parseLooseNumber(opp[1]);
        const a = parseLooseNumber(adj[1]);
        const deg = (Math.atan2(o, a) * 180) / Math.PI;
        return {
          answer: `${formatQty(deg)}°`,
          steps: [`tan⁻¹(opposite/adjacent) = tan⁻¹(${formatQty(o)}/${formatQty(a)}) = ${formatQty(deg)}°`],
        };
      }
    }
    // Pythagoras
    m = flat.match(
      /(?:pythagoras|pythagorean|right\s*triangle|right[- ]angled).*?(?:a\s*=\s*)?(-?\d+(?:\.\d+)?).*?(?:b\s*=\s*)?(-?\d+(?:\.\d+)?)/i
    );
    const legs = flat.match(
      /(?:legs?|sides?)\s*(-?\d+(?:\.\d+)?)\s*(?:and|,)\s*(-?\d+(?:\.\d+)?).*?(?:hypotenuse|find\s+c)/i
    );
    const hypFind = flat.match(
      /(?:hypotenuse|c)\s*(?:of\s*)?(?:a\s*)?right.*?(?:legs?|sides?)\s*(-?\d+(?:\.\d+)?)\s*(?:and|,)\s*(-?\d+(?:\.\d+)?)/i
    );
    const ab = legs || hypFind || m;
    if (ab || /pythagoras|hypotenuse.*legs|legs.*hypotenuse/i.test(flat)) {
      const nums = [...flat.matchAll(/(-?\d+(?:\.\d+)?)/g)].map((x) => parseLooseNumber(x[1]));
      if (nums.length >= 2) {
        const a = nums[0];
        const b = nums[1];
        if (/find\s*(?:leg|side)|missing\s*leg/i.test(flat) && nums.length >= 3) {
          const h = Math.max(...nums.slice(0, 3));
          const leg = nums.find((n) => n !== h);
          const other = Math.sqrt(h * h - leg * leg);
          return {
            answer: formatQty(other),
            steps: [`a² + b² = c² → b = √(c² − a²) = √(${h}² − ${leg}²) = ${formatQty(other)}`],
          };
        }
        const c = Math.sqrt(a * a + b * b);
        return {
          answer: formatQty(c),
          steps: [`a² + b² = c²`, `c = √(${formatQty(a)}² + ${formatQty(b)}²) = ${formatQty(c)}`],
        };
      }
    }
    return null;
  };

  const solveLogExp = (raw) => {
    const flat = raw.replace(/\u00a0/g, " ");
    let m = flat.match(/log\s*(?:base\s*)?(\d+(?:\.\d+)?)\s*(?:of\s*)?(\d+(?:\.\d+)?)/i);
    if (m) {
      const b = Number(m[1]);
      const a = Number(m[2]);
      const v = Math.log(a) / Math.log(b);
      return {
        answer: formatQty(v),
        steps: [`log_${b}(${a}) = ln(${a})/ln(${b}) = ${formatQty(v)}`],
      };
    }
    m = flat.match(/(?:solve\s+)?(\d+(?:\.\d+)?)\s*\^\s*x\s*=\s*(\d+(?:\.\d+)?)/i);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a <= 0 || b <= 0) return null;
      const x = Math.log(b) / Math.log(a);
      return {
        answer: `x = ${formatQty(x)}`,
        steps: [`${a}^x = ${b}`, `x = log(${b})/log(${a}) = ${formatQty(x)}`],
      };
    }
    m = flat.match(/(?:solve\s+)?e\s*\^\s*x\s*=\s*(\d+(?:\.\d+)?)/i);
    if (m) {
      const b = Number(m[1]);
      const x = Math.log(b);
      return { answer: `x = ${formatQty(x)}`, steps: [`x = ln(${b}) = ${formatQty(x)}`] };
    }
    m = flat.match(/ln\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\)?/i);
    if (m && /ln|natural/i.test(flat)) {
      const a = Number(m[1]);
      if (a <= 0) return { answer: "undefined", steps: ["ln of non-positive is undefined"] };
      return { answer: formatQty(Math.log(a)), steps: [`ln(${a}) = ${formatQty(Math.log(a))}`] };
    }
    return null;
  };

  const solveSequence = (raw) => {
    const flat = raw.replace(/\u00a0/g, " ");
    let m = flat.match(
      /(?:arithmetic|AP).*?(?:first\s*term|a1|a\s*=\s*)(-?\d+(?:\.\d+)?).*?(?:common\s*difference|d\s*=\s*)(-?\d+(?:\.\d+)?).*?(?:n\s*=\s*|term\s*)(-?\d+)/i
    );
    if (!m) {
      m = flat.match(
        /AP\s*:\s*a\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*d\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*n\s*=\s*(-?\d+)/i
      );
    }
    if (m) {
      const a = Number(m[1]);
      const d = Number(m[2]);
      const n = Number(m[3]);
      const an = a + (n - 1) * d;
      const sum = (n / 2) * (2 * a + (n - 1) * d);
      const wantSum = /sum|S_?n/i.test(flat);
      return {
        answer: wantSum ? formatQty(sum) : formatQty(an),
        steps: wantSum
          ? [`Sₙ = n/2 × (2a + (n−1)d)`, `S_${n} = ${formatQty(sum)}`]
          : [`aₙ = a + (n−1)d = ${a} + (${n}−1)×${d} = ${formatQty(an)}`],
      };
    }
    m = flat.match(
      /(?:geometric|GP).*?(?:first\s*term|a\s*=\s*)(-?\d+(?:\.\d+)?).*?(?:common\s*ratio|r\s*=\s*)(-?\d+(?:\.\d+)?).*?(?:n\s*=\s*|term\s*)(-?\d+)/i
    );
    if (!m) {
      m = flat.match(
        /GP\s*:\s*a\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*r\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*n\s*=\s*(-?\d+)/i
      );
    }
    if (m) {
      const a = Number(m[1]);
      const r = Number(m[2]);
      const n = Number(m[3]);
      const an = a * r ** (n - 1);
      const sum = r === 1 ? n * a : (a * (r ** n - 1)) / (r - 1);
      const wantSum = /sum|S_?n/i.test(flat);
      return {
        answer: wantSum ? formatQty(sum) : formatQty(an),
        steps: wantSum
          ? [`Sₙ = a(rⁿ − 1)/(r − 1)`, `S_${n} = ${formatQty(sum)}`]
          : [`aₙ = arⁿ⁻¹ = ${formatQty(an)}`],
      };
    }
    return null;
  };

  const solveCombinatorics = (raw) => {
    const flat = raw.replace(/\u00a0/g, " ");
    let m = flat.match(/(?:nCr|C\(|combination)\s*\(?\s*(\d+)\s*[, ]\s*(\d+)\s*\)?/i) ||
      flat.match(/(\d+)\s*[Cc]\s*(\d+)/) ||
      flat.match(/combin(?:ation|e)\s*(\d+)\s*(?:choose|from|things?).*?(\d+)/i) ||
      flat.match(/(\d+)\s*choose\s*(\d+)/i);
    if (m) {
      let n = Number(m[1]);
      let r = Number(m[2]);
      if (/from\s+\d+\s+choose|combin.*from/i.test(flat) && Number(m[1]) < Number(m[2])) {
        // "combine 3 from 10" style already handled by order in some patterns
      }
      if (flat.match(/from\s+(\d+).*?(\d+)\s*(?:at\s+a\s+time|items)/i)) {
        const mm = flat.match(/from\s+(\d+).*?(\d+)/i);
        if (mm) {
          n = Number(mm[1]);
          r = Number(mm[2]);
        }
      }
      if (r > n) [n, r] = [r, n];
      let c = 1;
      for (let i = 1; i <= r; i++) c = (c * (n - r + i)) / i;
      return {
        answer: formatQty(c),
        steps: [`C(${n},${r}) = n! / (r!(n−r)!)`, `= ${formatQty(c)}`],
      };
    }
    m = flat.match(/(?:nPr|P\(|permutation)\s*\(?\s*(\d+)\s*[, ]\s*(\d+)\s*\)?/i) ||
      flat.match(/(\d+)\s*[Pp]\s*(\d+)(?!\s*%)/) ||
      flat.match(/permut(?:ation|e)\s*(\d+)\s*.*?(\d+)/i);
    if (m) {
      const n = Number(m[1]);
      const r = Number(m[2]);
      let p = 1;
      for (let i = 0; i < r; i++) p *= n - i;
      return {
        answer: formatQty(p),
        steps: [`P(${n},${r}) = n!/(n−r)!`, `= ${formatQty(p)}`],
      };
    }
    m = flat.match(/(\d+)\s*!|factorial\s*(?:of\s*)?(\d+)/i);
    if (m) {
      const n = Number(m[1] || m[2]);
      if (n > 170) return { answer: "too large", steps: ["Factorial overflow"] };
      let f = 1;
      for (let i = 2; i <= n; i++) f *= i;
      return { answer: formatQty(f), steps: [`${n}! = ${formatQty(f)}`] };
    }
    return null;
  };

  const solveStats = (raw) => {
    const flat = raw.replace(/\u00a0/g, " ");
    const listM =
      flat.match(
        /(?:mean|median|mode|range|average|std(?:ev|andard\s*deviation)?|variance)\s*(?:of\s*)?\[?\s*([-\d.,\s]+)\s*\]?/i
      ) ||
      flat.match(/(?:numbers?|data|set)\s*[:\s]\s*([-\d.,\s]+)/i);
    if (!listM && !/mean|median|mode|range|average|std/i.test(flat)) return null;
    const nums = [...(listM ? listM[1] : flat).matchAll(/-?\d+(?:\.\d+)?/g)]
      .map((x) => Number(x[0]))
      .filter((n) => Number.isFinite(n));
    // Avoid grabbing stray words' numbers only — need enough data points
    if (nums.length < 2) return null;
    // If the question embeds many non-data numbers, prefer bracketed/list form
    const sorted = [...nums].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median =
      n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const freq = {};
    sorted.forEach((v) => {
      freq[v] = (freq[v] || 0) + 1;
    });
    const maxF = Math.max(...Object.values(freq));
    const modes = Object.keys(freq)
      .filter((k) => freq[k] === maxF)
      .map(Number);
    const range = sorted[n - 1] - sorted[0];
    const variance = sorted.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    const stdev = Math.sqrt(variance);

    if (/median/i.test(flat)) {
      return {
        answer: formatQty(median),
        steps: [`Sorted: ${sorted.join(", ")}`, `Median = ${formatQty(median)}`],
      };
    }
    if (/mode/i.test(flat)) {
      return {
        answer: modes.map(formatQty).join(", "),
        steps: [`Most frequent value(s)`, `Mode = ${modes.map(formatQty).join(", ")}`],
      };
    }
    if (/range/i.test(flat)) {
      return {
        answer: formatQty(range),
        steps: [`Range = max − min = ${sorted[n - 1]} − ${sorted[0]} = ${formatQty(range)}`],
      };
    }
    if (/std|standard\s*deviation/i.test(flat)) {
      return {
        answer: formatQty(stdev),
        steps: [`Population σ = √(Σ(x−μ)²/n)`, `σ = ${formatQty(stdev)}`],
      };
    }
    if (/variance/i.test(flat)) {
      return {
        answer: formatQty(variance),
        steps: [`Variance = Σ(x−μ)²/n = ${formatQty(variance)}`],
      };
    }
    if (/mean|average/i.test(flat)) {
      return {
        answer: formatQty(mean),
        steps: [`Mean = sum/n = ${formatQty(sum)}/${n} = ${formatQty(mean)}`],
      };
    }
    return null;
  };

  const solveGeometry = (raw) => {
    const flat = raw.replace(/,/g, "").replace(/\u00a0/g, " ");
    let m;
    // Circle
    m = flat.match(
      /(?:area|circumference|perimeter)\s*(?:of\s*)?(?:a\s*)?circle.*?(?:radius|r)\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i
    ) ||
      flat.match(/circle.*?radius\s*(-?\d+(?:\.\d+)?).*?(area|circumference)/i);
    if (m || (/circle/i.test(flat) && /radius/i.test(flat))) {
      const rM = flat.match(/radius\s*(?:is\s*|=\s*|of\s*)?(-?\d+(?:\.\d+)?)/i);
      if (!rM) return null;
      const r = parseLooseNumber(rM[1]);
      if (/circumference|perimeter/i.test(flat)) {
        const c = 2 * Math.PI * r;
        return {
          answer: formatQty(c),
          steps: [`C = 2πr = 2π(${formatQty(r)}) = ${formatQty(c)}`],
        };
      }
      const area = Math.PI * r * r;
      return {
        answer: formatQty(area),
        steps: [`A = πr² = π(${formatQty(r)})² = ${formatQty(area)}`],
      };
    }
    // Rectangle
    m = flat.match(
      /(?:area|perimeter)\s*(?:of\s*)?(?:a\s*)?rectangl.*?(?:length|l)\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?).*?(?:width|w|breadth)\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i
    );
    const lw = flat.match(
      /rectangl.*?(?:length|l)\s*(-?\d+(?:\.\d+)?).*?(?:width|breadth|w)\s*(-?\d+(?:\.\d+)?)/i
    );
    if (m || lw) {
      const L = parseLooseNumber((m || lw)[1]);
      const W = parseLooseNumber((m || lw)[2]);
      if (/perimeter/i.test(flat)) {
        const p = 2 * (L + W);
        return {
          answer: formatQty(p),
          steps: [`P = 2(L+W) = 2(${formatQty(L)}+${formatQty(W)}) = ${formatQty(p)}`],
        };
      }
      return {
        answer: formatQty(L * W),
        steps: [`A = L×W = ${formatQty(L)}×${formatQty(W)} = ${formatQty(L * W)}`],
      };
    }
    // Triangle area
    m = flat.match(
      /(?:area\s*(?:of\s*)?(?:a\s*)?triangle|triangle.*area).*?(?:base|b)\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?).*?(?:height|h)\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i
    );
    if (m || (/triangle/i.test(flat) && /base/i.test(flat) && /height/i.test(flat))) {
      const bM = flat.match(/base\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i);
      const hM = flat.match(/height\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i);
      if (bM && hM) {
        const b = parseLooseNumber(bM[1]);
        const h = parseLooseNumber(hM[1]);
        const a = 0.5 * b * h;
        return {
          answer: formatQty(a),
          steps: [`A = ½bh = ½×${formatQty(b)}×${formatQty(h)} = ${formatQty(a)}`],
        };
      }
    }
    // Cylinder volume
    if (/cylinder/i.test(flat) && /volume|capacity/i.test(flat)) {
      const rM = flat.match(/radius\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i);
      const hM = flat.match(/height\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i);
      if (rM && hM) {
        const r = parseLooseNumber(rM[1]);
        const h = parseLooseNumber(hM[1]);
        const v = Math.PI * r * r * h;
        return {
          answer: formatQty(v),
          steps: [`V = πr²h = π(${formatQty(r)})²(${formatQty(h)}) = ${formatQty(v)}`],
        };
      }
    }
    // Sphere
    if (/sphere/i.test(flat) && (/volume|area|surface/i.test(flat))) {
      const rM = flat.match(/radius\s*(?:is\s*|=\s*)?(-?\d+(?:\.\d+)?)/i);
      if (rM) {
        const r = parseLooseNumber(rM[1]);
        if (/volume/i.test(flat)) {
          const v = (4 / 3) * Math.PI * r ** 3;
          return {
            answer: formatQty(v),
            steps: [`V = ⁴⁄₃πr³ = ${formatQty(v)}`],
          };
        }
        const a = 4 * Math.PI * r * r;
        return {
          answer: formatQty(a),
          steps: [`A = 4πr² = ${formatQty(a)}`],
        };
      }
    }
    return null;
  };

  const solveWorkRate = (raw) => {
    const flat = raw.replace(/,/g, "").replace(/\u00a0/g, " ");
    // A does in X hours, B in Y hours, together?
    const m = flat.match(
      /(?:A|one)\s*(?:can\s*)?(?:do|finish|complete).*?(-?\d+(?:\.\d+)?)\s*(?:hours?|days?).*?(?:B|another|other).*?(-?\d+(?:\.\d+)?)\s*(?:hours?|days?).*?(?:together|combined|both)/i
    );
    const m2 = flat.match(
      /(-?\d+(?:\.\d+)?)\s*(?:hours?|days?).+?(-?\d+(?:\.\d+)?)\s*(?:hours?|days?).+(?:together|combined)/i
    );
    if (m || m2) {
      const src = m || m2;
      const a = parseLooseNumber(src[1]);
      const b = parseLooseNumber(src[2]);
      if (!a || !b) return null;
      const t = 1 / (1 / a + 1 / b);
      return {
        answer: `${formatQty(t)} hours`,
        steps: [
          `Rates: 1/${formatQty(a)} + 1/${formatQty(b)} per hour`,
          `Together time = 1 / (1/a + 1/b) = ${formatQty(t)} hours`,
        ],
      };
    }
    return null;
  };

  const nCr = (n, r) => {
    if (r < 0 || n < 0 || r > n) return 0;
    let c = 1;
    for (let i = 1; i <= r; i++) c = (c * (n - r + i)) / i;
    return c;
  };

  const solveProbability = (raw) => {
    const flat = raw.replace(/\u00a0/g, " ");

    // Binomial: P(X=k) for n trials, success p
    let m = flat.match(
      /binomial.*?(?:n\s*=\s*)?(\d+).*?(?:k\s*=\s*|x\s*=\s*|exactly\s*)(\d+).*?(?:p\s*=\s*)?(-?\d+(?:\.\d+)?)/i
    );
    if (!m) {
      m = flat.match(
        /probability\s+of\s+(?:exactly\s+)?(\d+)\s+success(?:es)?\s+in\s+(\d+)\s+trials?\s+(?:with\s+)?p\s*=\s*(-?\d+(?:\.\d+)?)/i
      );
    }
    if (m) {
      let n;
      let k;
      let p;
      if (/binomial/i.test(flat) && /n\s*=/i.test(flat)) {
        n = Number(m[1]);
        k = Number(m[2]);
        p = Number(m[3]);
      } else if (/success/i.test(flat)) {
        k = Number(m[1]);
        n = Number(m[2]);
        p = Number(m[3]);
      } else {
        n = Number(m[1]);
        k = Number(m[2]);
        p = Number(m[3]);
      }
      if (p > 1) p = p / 100;
      const prob = nCr(n, k) * p ** k * (1 - p) ** (n - k);
      return {
        answer: formatQty(prob),
        steps: [
          `Binomial: P(X=k) = C(n,k) p^k (1−p)^(n−k)`,
          `n=${n}, k=${k}, p=${formatQty(p)}`,
          `P(X=${k}) = ${formatQty(prob)}`,
        ],
      };
    }

    // Independent: P(A and B) = P(A)P(B)
    m = flat.match(
      /(?:independent|P\s*\(\s*A\s*(?:and|&)\s*B\s*\)).*?(-?\d+(?:\.\d+)?)\s*(?:and|,)\s*(-?\d+(?:\.\d+)?)/i
    ) ||
      flat.match(
        /P\s*\(\s*A\s*\)\s*=\s*(-?\d+(?:\.\d+)?).*?P\s*\(\s*B\s*\)\s*=\s*(-?\d+(?:\.\d+)?).*?(?:and|both|independent)/i
      );
    if (m) {
      let a = Number(m[1]);
      let b = Number(m[2]);
      if (a > 1) a /= 100;
      if (b > 1) b /= 100;
      return {
        answer: formatQty(a * b),
        steps: [
          `Independent events: P(A∩B) = P(A)·P(B)`,
          `${formatQty(a)} × ${formatQty(b)} = ${formatQty(a * b)}`,
        ],
      };
    }

    // Conditional: P(A|B) = P(A and B) / P(B)
    m = flat.match(
      /P\s*\(\s*A\s*\|\s*B\s*\).*?P\s*\(\s*A\s*(?:and|&)\s*B\s*\)\s*=\s*(-?\d+(?:\.\d+)?).*?P\s*\(\s*B\s*\)\s*=\s*(-?\d+(?:\.\d+)?)/i
    ) ||
      flat.match(
        /conditional.*?(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/i
      );
    if (m) {
      let num = Number(m[1]);
      let den = Number(m[2]);
      if (num > 1) num /= 100;
      if (den > 1) den /= 100;
      if (!den) return null;
      return {
        answer: formatQty(num / den),
        steps: [
          `P(A|B) = P(A∩B) / P(B)`,
          `${formatQty(num)} / ${formatQty(den)} = ${formatQty(num / den)}`,
        ],
      };
    }

    // Coin flips
    if (/coin/i.test(flat) && /probability|chance/i.test(flat)) {
      const nFlip = flat.match(/(\d+)\s*(?:times|flips?|coins?)/i);
      if (/heads\s+and\s+tails|one\s+head.*one\s+tail/i.test(flat) && nFlip && Number(nFlip[1]) === 2) {
        return {
          answer: "1/2",
          steps: ["Two fair coins: HT, TH out of HH,HT,TH,TT", "P = 2/4 = 1/2"],
        };
      }
      if (/heads|tails/i.test(flat)) {
        const n = nFlip ? Number(nFlip[1]) : 1;
        if (/all\s+heads|n heads/i.test(flat) || (n > 1 && /heads/i.test(flat) && /all|every/i.test(flat))) {
          const p = 0.5 ** n;
          return {
            answer: formatQty(p),
            steps: [`Fair coin, ${n} flips all heads`, `P = (1/2)^${n} = ${formatQty(p)}`],
          };
        }
        return {
          answer: "1/2",
          steps: ["Fair coin: P(heads) = P(tails) = 1/2"],
        };
      }
    }

    // Cards
    if (/card|deck/i.test(flat) && /probability|chance/i.test(flat)) {
      if (/ace/i.test(flat)) {
        return {
          answer: "1/13",
          steps: ["Standard deck: 4 aces / 52 cards = 1/13"],
        };
      }
      if (/heart|diamond|club|spade/i.test(flat)) {
        return {
          answer: "1/4",
          steps: ["13 cards per suit / 52 = 1/4"],
        };
      }
      if (/face\s*card|king|queen|jack/i.test(flat)) {
        return {
          answer: "3/13",
          steps: ["12 face cards / 52 = 3/13"],
        };
      }
    }

    m = flat.match(/probability.*?(?:rolling|roll).*?(\d+).*?(?:die|dice)/i);
    if (m || (/die|dice/i.test(flat) && /probability|chance/i.test(flat))) {
      const face = flat.match(/(?:rolling|roll(?:ing)?|getting|get)\s*(?:a\s*)?(\d+)/i);
      if (face) {
        const f = Number(face[1]);
        if (f >= 1 && f <= 6) {
          return {
            answer: "1/6",
            steps: [`Fair six-sided die`, `P(${f}) = 1/6 ≈ ${formatQty(1 / 6)}`],
          };
        }
      }
      if (/even/i.test(flat)) {
        return { answer: "1/2", steps: ["Even faces: 2,4,6 → 3/6 = 1/2"] };
      }
      if (/odd/i.test(flat)) {
        return { answer: "1/2", steps: ["Odd faces: 1,3,5 → 3/6 = 1/2"] };
      }
      if (/greater\s+than\s+(\d+)/i.test(flat)) {
        const g = Number(flat.match(/greater\s+than\s+(\d+)/i)[1]);
        const fav = [1, 2, 3, 4, 5, 6].filter((x) => x > g).length;
        return {
          answer: `${fav}/6`,
          steps: [`Faces > ${g}: ${fav} outcomes`, `P = ${fav}/6`],
        };
      }
    }

    m = flat.match(/P\s*\(\s*(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)\s*\)/i);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      return {
        answer: formatQty(a / b),
        steps: [`P = ${a}/${b} = ${formatQty(a / b)}`],
      };
    }
    m = flat.match(
      /(?:probability|chance)\s*(?:of\s*)?(-?\d+)\s*(?:out\s*of|in|\/)\s*(-?\d+)/i
    );
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      return {
        answer: formatQty(a / b),
        steps: [`P = favorable/total = ${a}/${b} = ${formatQty(a / b)}`],
      };
    }
    return null;
  };

  const solveSecondDerivative = (raw) => {
    const m = raw.match(/(?:second\s*derivative|d\^2\/dx\^2|f''|differentiate\s+twice)\s*(?:of\s*)?(.+)/i);
    if (!m) return null;
    const c1 = derivative(parsePoly(m[1]));
    const c2 = derivative(c1);
    return {
      answer: polyToString(c2),
      steps: [
        `f(x) = ${polyToString(parsePoly(m[1]))}`,
        `f'(x) = ${polyToString(c1)}`,
        `f''(x) = ${polyToString(c2)}`,
      ],
    };
  };

  const solveDefiniteIntegral = (raw) => {
    const m = raw.match(
      /(?:integrate|integral|∫)\s+(.+?)\s+(?:from\s+)?(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i
    );
    if (!m) return null;
    const coeffs = parsePoly(m[1].replace(/dx/i, "").trim());
    const F = integrate(coeffs);
    const evalPoly = (c, x) =>
      Object.keys(c).reduce((s, p) => s + c[p] * x ** Number(p), 0);
    const a = Number(m[2]);
    const b = Number(m[3]);
    const v = evalPoly(F, b) - evalPoly(F, a);
    return {
      answer: formatQty(v),
      steps: [
        `∫ f(x) dx = ${polyToString(F)} + C`,
        `Evaluate from ${a} to ${b}`,
        `F(${b}) − F(${a}) = ${formatQty(v)}`,
      ],
    };
  };

  const evalPolyAt = (c, x) =>
    Object.keys(c).reduce((s, p) => s + c[p] * x ** Number(p), 0);

  const solveLimit = (raw) => {
    const m = raw.match(
      /(?:limit|lim)\s*(?:as\s*)?x\s*→\s*(-?\d+(?:\.\d+)?|infinity|∞)\s*(?:of\s*)?(.+)/i
    ) ||
      raw.match(/limit\s+of\s+(.+?)\s+as\s+x\s*(?:approaches|→|->)\s*(-?\d+(?:\.\d+)?|infinity|∞)/i);
    if (!m) return null;
    let expr;
    let at;
    if (/limit\s+of/i.test(raw)) {
      expr = m[1];
      at = m[2];
    } else {
      at = m[1];
      expr = m[2];
    }
    expr = expr.replace(/\$/g, "").trim();
    if (/infinity|∞/i.test(String(at))) {
      const coeffs = parsePoly(expr);
      const powers = Object.keys(coeffs)
        .map(Number)
        .filter((p) => coeffs[p]);
      if (!powers.length) return null;
      const deg = Math.max(...powers);
      const lead = coeffs[deg];
      if (deg > 0) {
        return {
          answer: lead > 0 ? "∞" : "−∞",
          steps: [
            `Leading term ${formatQty(lead)}x^${deg} dominates as x→∞`,
            `limit = ${lead > 0 ? "∞" : "−∞"}`,
          ],
        };
      }
      return {
        answer: formatQty(lead),
        steps: [`Constant polynomial → limit ${formatQty(lead)}`],
      };
    }
    const x0 = Number(at);
    const coeffs = parsePoly(expr);
    if (Object.keys(coeffs).length) {
      const v = evalPolyAt(coeffs, x0);
      return {
        answer: formatQty(v),
        steps: [
          `Polynomials are continuous`,
          `lim(x→${x0}) = f(${x0}) = ${formatQty(v)}`,
        ],
      };
    }
    const v = evalMath(expr.replace(/x/gi, `(${x0})`));
    if (v !== null) {
      return {
        answer: formatQty(v),
        steps: [`Substitute x = ${x0}`, `limit = ${formatQty(v)}`],
      };
    }
    return null;
  };

  const solveCriticalPoints = (raw) => {
    const m = raw.match(
      /(?:critical\s*points?|stationary\s*points?|find\s+extrema|max(?:imum)?\s+and\s+min(?:imum)?)\s*(?:of\s*)?(.+)/i
    );
    if (!m) return null;
    const coeffs = parsePoly(m[1]);
    const d = derivative(coeffs);
    // Solve f'=0 for linear or quadratic derivative
    const a = d[2] || 0;
    const b = d[1] || 0;
    const c = d[0] || 0;
    const roots = [];
    if (Math.abs(a) > 1e-12) {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        roots.push((-b + Math.sqrt(disc)) / (2 * a));
        roots.push((-b - Math.sqrt(disc)) / (2 * a));
      }
    } else if (Math.abs(b) > 1e-12) {
      roots.push(-c / b);
    }
    if (!roots.length) {
      return {
        answer: "No critical points",
        steps: [`f'(x) = ${polyToString(d)}`, "f'(x) = 0 has no real root"],
      };
    }
    const uniq = [...new Set(roots.map((r) => formatQty(r)))];
    const d2 = derivative(d);
    const classified = uniq.map((xs) => {
      const x = Number(xs);
      const curv = evalPolyAt(d2, x);
      const kind = curv > 0 ? "local min" : curv < 0 ? "local max" : "inflection/test inconclusive";
      const y = evalPolyAt(coeffs, x);
      return `x=${xs} (${kind}), f=${formatQty(y)}`;
    });
    return {
      answer: classified.join("; "),
      steps: [
        `f(x) = ${polyToString(coeffs)}`,
        `f'(x) = ${polyToString(d)} = 0`,
        `Critical x: ${uniq.join(", ")}`,
        ...classified,
      ],
    };
  };

  const looksLikeGeneralKnowledge = (q) => {
    if (
      /[\d]+\s*[+\-*/^=]|derivative|integral|solve\s+\d|quadratic|sin\s*\d|cos\s*\d|log\s|nCr|probability of|km\/h|₦|naira|%|x\^/i.test(
        q
      )
    ) {
      return false;
    }
    return /^(who|what|where|when|why|how|explain|define|describe|tell me|capital of|president|history|science|biology|chemistry|physics|geography|literature|which)\b/i.test(
      q
    ) || /\b(who is|what is|what are|where is|capital of|meaning of|definition of)\b/i.test(q);
  };

  const answerGeneralSubject = async (q) => {
    const topic = q
      .replace(
        /^(please\s+)?(can you\s+)?(tell me\s+)?(about\s+|explain\s+|define\s+|describe\s+|what is\s+|what are\s+|who is\s+|who was\s+|where is\s+|when was\s+|why is\s+|how does\s+|how do\s+)?/i,
        ""
      )
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/\?+$/g, "")
      .trim();
    if (topic.length < 2) return null;

    const wikiHeaders = {
      Accept: "application/json",
      "Api-User-Agent": "OdogwuCalc/1.0 (https://github.com/collins-geodev/lumen-calc; educational calculator)",
    };

    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        topic
      )}&limit=1&namespace=0&format=json&origin=*`;
      const search = await fetch(searchUrl, { headers: wikiHeaders }).then((r) => r.json());
      const title = search?.[1]?.[0];
      const pageUrl = search?.[3]?.[0];

      if (title) {
        const sumRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
          { headers: wikiHeaders }
        );
        if (sumRes.ok) {
          const sum = await sumRes.json();
          if (sum?.extract) {
            return {
              answer: sum.extract,
              steps: [
                `Subject: ${sum.title}${sum.description ? ` — ${sum.description}` : ""}`,
                "General knowledge answer (Wikipedia)",
                sum.content_urls?.desktop?.page || pageUrl
                  ? `Source: ${sum.content_urls?.desktop?.page || pageUrl}`
                  : "Source: Wikipedia",
              ],
            };
          }
        }
        // Fallback: plain extract via action=query
        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(
          title
        )}&format=json&origin=*`;
        const extractData = await fetch(extractUrl, { headers: wikiHeaders }).then((r) => r.json());
        const pages = extractData?.query?.pages || {};
        const page = Object.values(pages)[0];
        if (page?.extract) {
          return {
            answer: page.extract,
            steps: [
              `Subject: ${page.title}`,
              "General knowledge answer (Wikipedia)",
              pageUrl ? `Source: ${pageUrl}` : "Source: Wikipedia",
            ],
          };
        }
      }

      const ddg = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`
      ).then((r) => r.json());
      const text = ddg.AbstractText || ddg.Answer || "";
      if (text) {
        return {
          answer: text,
          steps: [
            `General knowledge: ${ddg.Heading || topic}`,
            ddg.AbstractURL ? `Source: ${ddg.AbstractURL}` : "Source: DuckDuckGo",
          ],
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  const normalizeQuestion = (raw) =>
    raw
      .replace(/\u00a0/g, " ")
      .replace(/question\s*:\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const thinkMath = (raw) => {
    const q = normalizeQuestion(raw);
    if (!q) {
      return { answer: "Ask a question first", steps: [] };
    }

    const temp = window.LumenUnits?.answerTempPrompt?.(q);
    if (temp) return temp;

    const pipeline = [
      solveDiscountWord,
      solveCompoundInterestWord,
      solveSimpleInterestWord,
      solvePercentChangeWord,
      solveBudgetWord,
      solveMotionWord,
      solveProportionWord,
      solveUnitRateWord,
      solveCostWord,
      solveWorkRate,
      solveGeometry,
      solveTrig,
      solveSystem2,
      solveLogExp,
      solveSequence,
      solveCombinatorics,
      solveStats,
      solveProbability,
      solveLimit,
      solveCriticalPoints,
      solveSecondDerivative,
      solveDefiniteIntegral,
    ];
    for (const fn of pipeline) {
      const r = fn(q);
      if (r) return r;
    }

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

    m = q.match(/(?:what\s+is|calculate|compute|eval(?:uate)?|find)\s+(.+)/i);
    if (m) {
      const v = evalMath(m[1]) ?? evalSimple(m[1]);
      if (v !== null) return { answer: String(v), steps: [`Evaluated ${m[1]}`, `= ${v}`] };
    }

    const direct = evalMath(q) ?? evalSimple(q);
    if (direct !== null) {
      return { answer: String(direct), steps: ["Parsed as math expression", `= ${direct}`] };
    }

    return null;
  };

  const think = async (raw) => {
    const q = normalizeQuestion(raw);
    if (!q) {
      return { answer: "Ask a question first", steps: [] };
    }

    const math = thinkMath(q);
    if (math) return math;

    if (looksLikeGeneralKnowledge(q) || q.split(/\s+/).length >= 3) {
      const general = await answerGeneralSubject(q);
      if (general) return general;
    }

    return {
      answer: "I couldn't answer that yet",
      steps: [
        "Math: probability, calculus, trig, algebra, geometry, finance word problems",
        "Examples: binomial n=10 k=3 p=0.5 · limit as x→2 of x^2+1 · cot 45",
        "Critical points of x^3-3x · law of cosines a=5 b=7 C=60",
        "General subjects: Who is Chinua Achebe? · What is photosynthesis?",
        "Capital of Nigeria? · Explain gravity",
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

  const ask = async () => {
    const q = document.getElementById("aiInput").value;
    const btn = document.getElementById("aiAskBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Thinking…";
    }
    try {
      render({ answer: "Thinking…", steps: ["Working through your question"] });
      const result = await think(q);
      render(result);
      window.LumenUI?.toast?.("Thought complete");
    } catch {
      render({
        answer: "Something went wrong while thinking",
        steps: ["Check your connection for general-knowledge questions, then try again"],
      });
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Think";
      }
    }
  };

  const init = () => {
    document.getElementById("aiAskBtn").addEventListener("click", ask);
    document.getElementById("aiClearBtn").addEventListener("click", () => {
      document.getElementById("aiInput").value = "";
      render({ answer: "Ask math or any general subject question", steps: [] });
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
