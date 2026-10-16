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

  const think = (raw) => {
    const q = raw.trim();
    if (!q) {
      return { answer: "Ask a math question first", steps: [] };
    }

    const temp = window.LumenUnits?.answerTempPrompt?.(q);
    if (temp) return temp;

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
        "Try: solve 2x+5=17",
        "quadratic x^2-5x+6=0",
        "derivative of 3x^4-2x",
        "integrate x^2",
        "15% of 240 · gcd of 84 and 36 · convert 72 F to C",
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
