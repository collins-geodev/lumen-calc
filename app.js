(() => {
  const exprEl = document.getElementById("expr");
  const resultEl = document.getElementById("result");
  const previewEl = document.getElementById("preview");
  const hintEl = document.getElementById("hint");
  const displayEl = document.getElementById("display");
  const keysEl = document.getElementById("keys");
  const sciKeysEl = document.getElementById("sciKeys");
  const memKeysEl = document.getElementById("memKeys");
  const toastEl = document.getElementById("toast");
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  const historyEmpty = document.getElementById("historyEmpty");
  const chassis = document.getElementById("chassis");
  const modeBtn = document.getElementById("modeBtn");
  const angleBtn = document.getElementById("angleBtn");
  const angleBadge = document.getElementById("angleBadge");
  const memBadge = document.getElementById("memBadge");
  const secondBtn = document.getElementById("secondBtn");

  let expr = "";
  let justEquals = false;
  let lastOp = null;
  let history = [];
  let memory = 0;
  let ans = 0;
  let angleMode = "deg"; // deg | rad
  let second = false;
  let sciMode = true;

  const FN_NAMES = [
    "asinh",
    "acosh",
    "atanh",
    "asin",
    "acos",
    "atan",
    "sinh",
    "cosh",
    "tanh",
    "sin",
    "cos",
    "tan",
    "sqrt",
    "cbrt",
    "log2",
    "log",
    "ln",
    "exp",
    "abs",
    "floor",
    "ceil",
    "round",
    "pow10",
    "pow2",
  ].sort((a, b) => b.length - a.length);

  const CONST_NAMES = ["pi", "ans", "e"];

  const toRad = (x) => (angleMode === "deg" ? (x * Math.PI) / 180 : x);
  const fromRad = (x) => (angleMode === "deg" ? (x * 180) / Math.PI : x);

  const factorial = (n) => {
    if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error("Bad factorial");
    let r = 1;
    for (let i = 2; i <= n; i += 1) r *= i;
    return r;
  };

  const format = (n) => {
    if (!Number.isFinite(n)) return "∞";
    return Number(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const lastNumberSpan = (s) => {
    const m = s.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?(?!.*(?:\d|\.\d))/i);
    if (!m) return null;
    return { start: m.index, end: m.index + m[0].length, value: m[0] };
  };

  const applyFn = (name, a) => {
    switch (name) {
      case "sin":
        return Math.sin(toRad(a));
      case "cos":
        return Math.cos(toRad(a));
      case "tan":
        return Math.tan(toRad(a));
      case "asin":
        return fromRad(Math.asin(a));
      case "acos":
        return fromRad(Math.acos(a));
      case "atan":
        return fromRad(Math.atan(a));
      case "sinh":
        return Math.sinh(a);
      case "cosh":
        return Math.cosh(a);
      case "tanh":
        return Math.tanh(a);
      case "asinh":
        return Math.asinh(a);
      case "acosh":
        return Math.acosh(a);
      case "atanh":
        return Math.atanh(a);
      case "ln":
        if (a <= 0) throw new Error("Bad ln");
        return Math.log(a);
      case "log":
        if (a <= 0) throw new Error("Bad log");
        return Math.log10(a);
      case "log2":
        if (a <= 0) throw new Error("Bad log2");
        return Math.log2(a);
      case "exp":
        return Math.exp(a);
      case "pow10":
        return 10 ** a;
      case "pow2":
        return 2 ** a;
      case "sqrt":
        if (a < 0) throw new Error("Bad sqrt");
        return Math.sqrt(a);
      case "cbrt":
        return Math.cbrt(a);
      case "abs":
        return Math.abs(a);
      case "floor":
        return Math.floor(a);
      case "ceil":
        return Math.ceil(a);
      case "round":
        return Math.round(a);
      default:
        throw new Error("Unknown fn");
    }
  };

  const tokenize = (input) => {
    const tokens = [];
    let i = 0;
    const src = input
      .replace(/π/g, "pi")
      .replace(/√/g, "sqrt")
      .replace(/∛/g, "cbrt")
      .replace(/mod/gi, "%");

    while (i < src.length) {
      const ch = src[i];
      if (ch === " ") {
        i += 1;
        continue;
      }

      if (/[0-9.]/.test(ch)) {
        let num = ch;
        i += 1;
        while (i < src.length && /[0-9.]/.test(src[i])) {
          num += src[i];
          i += 1;
        }
        if (src[i] === "e" || src[i] === "E") {
          const next = src[i + 1];
          if (next === "+" || next === "-" || /[0-9]/.test(next)) {
            num += src[i];
            i += 1;
            if (src[i] === "+" || src[i] === "-") {
              num += src[i];
              i += 1;
            }
            while (i < src.length && /[0-9]/.test(src[i])) {
              num += src[i];
              i += 1;
            }
          }
        }
        tokens.push({ type: "num", value: Number(num) });
        continue;
      }

      if (ch === "!") {
        tokens.push({ type: "postfix", value: "!" });
        i += 1;
        continue;
      }

      if ("+-*/^%()".includes(ch)) {
        const prev = tokens[tokens.length - 1];
        const unary =
          ch === "-" &&
          (!prev ||
            prev.type === "op" ||
            (prev.type === "paren" && prev.value === "(") ||
            prev.type === "fn");
        tokens.push({
          type: unary ? "op" : ch === "(" || ch === ")" ? "paren" : "op",
          value: unary ? "neg" : ch,
        });
        i += 1;
        continue;
      }

      let matched = false;
      for (const name of FN_NAMES) {
        if (src.slice(i, i + name.length) === name) {
          tokens.push({ type: "fn", value: name });
          i += name.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      for (const name of CONST_NAMES) {
        if (src.slice(i, i + name.length) === name) {
          const value = name === "pi" ? Math.PI : name === "e" ? Math.E : ans;
          tokens.push({ type: "num", value });
          i += name.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      throw new Error("Unexpected token");
    }

    const implied = [];
    for (let t = 0; t < tokens.length; t += 1) {
      const a = implied[implied.length - 1];
      const b = tokens[t];
      if (
        a &&
        ((a.type === "num" &&
          (b.type === "fn" || (b.type === "paren" && b.value === "(") || b.type === "num")) ||
          (a.type === "paren" &&
            a.value === ")" &&
            (b.type === "num" ||
              b.type === "fn" ||
              (b.type === "paren" && b.value === "("))) ||
          (a.type === "postfix" &&
            (b.type === "num" || b.type === "fn" || (b.type === "paren" && b.value === "("))))
      ) {
        implied.push({ type: "op", value: "*" });
      }
      implied.push(b);
    }
    return implied;
  };

  const prec = { neg: 5, "!": 6, "^": 4, "*": 3, "/": 3, "%": 3, "+": 2, "-": 2 };
  const rightAssoc = { "^": true, neg: true };

  const toRpn = (tokens) => {
    const out = [];
    const ops = [];
    for (const tok of tokens) {
      if (tok.type === "num") out.push(tok);
      else if (tok.type === "fn") ops.push(tok);
      else if (tok.type === "postfix") {
        while (ops.length) {
          const top = ops[ops.length - 1];
          if (top.type !== "op" && top.type !== "fn" && top.type !== "postfix") break;
          const pTop = top.type === "fn" ? 7 : prec[top.value];
          if (pTop >= prec["!"]) out.push(ops.pop());
          else break;
        }
        out.push(tok);
      } else if (tok.type === "op") {
        while (ops.length) {
          const top = ops[ops.length - 1];
          if (top.type !== "op" && top.type !== "fn") break;
          const pTop = top.type === "fn" ? 7 : prec[top.value];
          const pCur = prec[tok.value];
          if (pTop > pCur || (pTop === pCur && !rightAssoc[tok.value])) out.push(ops.pop());
          else break;
        }
        ops.push(tok);
      } else if (tok.value === "(") ops.push(tok);
      else if (tok.value === ")") {
        while (ops.length && ops[ops.length - 1].value !== "(") out.push(ops.pop());
        if (!ops.length) throw new Error("Mismatched parentheses");
        ops.pop();
        if (ops.length && ops[ops.length - 1].type === "fn") out.push(ops.pop());
      }
    }
    while (ops.length) {
      const top = ops.pop();
      if (top.type === "paren") throw new Error("Mismatched parentheses");
      out.push(top);
    }
    return out;
  };

  const evalRpn = (rpn) => {
    const st = [];
    for (const tok of rpn) {
      if (tok.type === "num") st.push(tok.value);
      else if (tok.type === "fn") {
        const a = st.pop();
        if (a === undefined) throw new Error("Incomplete");
        const v = applyFn(tok.value, a);
        if (!Number.isFinite(v)) throw new Error("Domain");
        st.push(v);
      } else if (tok.type === "postfix" && tok.value === "!") {
        const a = st.pop();
        if (a === undefined) throw new Error("Incomplete");
        st.push(factorial(a));
      } else if (tok.value === "neg") {
        const a = st.pop();
        st.push(-a);
      } else {
        const b = st.pop();
        const a = st.pop();
        if (a === undefined || b === undefined) throw new Error("Incomplete");
        if (tok.value === "+") st.push(a + b);
        else if (tok.value === "-") st.push(a - b);
        else if (tok.value === "*") st.push(a * b);
        else if (tok.value === "/") {
          if (b === 0) throw new Error("Divide by zero");
          st.push(a / b);
        } else if (tok.value === "^") st.push(a ** b);
        else if (tok.value === "%") st.push(a % b);
      }
    }
    if (st.length !== 1) throw new Error("Incomplete");
    return st[0];
  };

  const evaluate = (input) => {
    const cleaned = input.trim();
    if (!cleaned) return { ok: true, value: 0, incomplete: true };
    try {
      const tokens = tokenize(cleaned);
      const last = tokens[tokens.length - 1];
      if (
        last &&
        (last.type === "op" ||
          (last.type === "paren" && last.value === "(") ||
          last.type === "fn")
      ) {
        return { ok: true, value: null, incomplete: true };
      }
      return { ok: true, value: evalRpn(toRpn(tokens)), incomplete: false };
    } catch {
      return { ok: false, value: null, incomplete: true };
    }
  };

  const prettyExpr = (s) =>
    s
      .replace(/\*/g, " × ")
      .replace(/\//g, " ÷ ")
      .replace(/%/g, " mod ")
      .replace(/-/g, " − ")
      .replace(/\+/g, " + ")
      .replace(/\^/g, " ^ ")
      .replace(/sqrt/g, "√")
      .replace(/cbrt/g, "∛")
      .replace(/pi/g, "π")
      .replace(/\s+/g, " ")
      .trim();

  const updateMemBadge = () => {
    memBadge.hidden = memory === 0;
  };

  const updateAngleUi = () => {
    angleBtn.textContent = angleMode === "deg" ? "Deg" : "Rad";
    angleBadge.textContent = angleMode === "deg" ? "DEG" : "RAD";
  };

  const updateSecondUi = () => {
    secondBtn.classList.toggle("active", second);
    sciKeysEl.querySelectorAll("[data-alt]").forEach((btn) => {
      const label = second ? btn.dataset.altLabel : btn.dataset.label;
      if (label) btn.textContent = label;
    });
  };

  const render = () => {
    exprEl.textContent = prettyExpr(expr) || "";
    const ev = evaluate(expr);
    if (justEquals && ev.ok && ev.value !== null) {
      resultEl.textContent = format(ev.value);
      previewEl.textContent = "";
    } else if (ev.ok && ev.value !== null && !ev.incomplete) {
      resultEl.textContent = expr ? format(ev.value) : "0.00";
      previewEl.textContent = expr ? "live · " + format(ev.value) : "";
    } else {
      if (!expr) resultEl.textContent = "0.00";
      previewEl.textContent = !expr ? "" : ev.ok ? "…" : "waiting for a complete thought";
    }
  };

  const pulse = () => {
    resultEl.classList.remove("pulse");
    void resultEl.offsetWidth;
    resultEl.classList.add("pulse");
  };

  const shake = () => {
    displayEl.classList.remove("shake");
    void displayEl.offsetWidth;
    displayEl.classList.add("shake");
  };

  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    window.clearTimeout(toast.t);
    toast.t = window.setTimeout(() => toastEl.classList.remove("show"), 1400);
  };

  window.LumenUI = { toast };

  let activePanel = "calc";
  const tagline = document.getElementById("tagline");
  const TAGS = {
    calc: "smart · scientific · shine",
    currency: "live fx · 150+ currencies",
    units: "precise · multi-category units",
    programmer: "hex · bitwise · bases",
    ai: "ask · explain · advanced math",
  };

  const setPanel = (name) => {
    activePanel = name;
    chassis.dataset.panel = name;
    chassis.classList.toggle("wide", name !== "calc" || sciMode);
    chassis.classList.toggle("sci-mode", name === "calc" && sciMode);
    document.querySelectorAll(".mode-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.panel === name);
    });
    document.querySelectorAll(".panel").forEach((panel) => {
      const on = panel.dataset.panel === name;
      panel.classList.toggle("active", on);
      panel.hidden = !on;
    });
    if (tagline) tagline.textContent = TAGS[name] || TAGS.calc;
    if (name === "currency") window.LumenFX?.convert?.();
    if (name === "units") window.LumenUnits?.convert?.();
  };

  const endsWithOp = () => /[+\-*/^%]$/.test(expr);

  const needsMulBefore = () => /[0-9)πe!]|pi$|ans$|e$/.test(expr);

  const insertDigit = (d) => {
    if (justEquals) {
      expr = "";
      justEquals = false;
    }
    if (/(?:pi|ans|e)$/.test(expr) || expr.endsWith(")")) expr += "*";
    const span = lastNumberSpan(expr);
    if (span && span.end === expr.length && span.value === "0" && d !== ".") {
      expr = expr.slice(0, span.start) + d;
    } else {
      expr += d;
    }
    render();
  };

  const insertOp = (op) => {
    if (justEquals) justEquals = false;
    if (!expr && op === "-") {
      expr = "-";
      render();
      return;
    }
    if (!expr) return;
    if (endsWithOp()) expr = expr.slice(0, -1) + op;
    else if (expr.endsWith("(") && op !== "-") return;
    else expr += op;
    lastOp = { op, rhs: null };
    render();
  };

  const insertDot = () => {
    if (justEquals) {
      expr = "0.";
      justEquals = false;
      render();
      return;
    }
    const span = lastNumberSpan(expr);
    if (span && span.value.includes(".")) return;
    if (!span || endsWithOp() || expr.endsWith("(") || !expr) {
      expr += expr && /[0-9)!]$/.test(expr) ? "*0." : "0.";
    } else expr += ".";
    render();
  };

  const insertConst = (token) => {
    if (justEquals) {
      expr = "";
      justEquals = false;
    }
    if (needsMulBefore()) expr += "*";
    expr += token;
    render();
  };

  const insertFn = (name) => {
    if (justEquals) {
      justEquals = false;
      const ev = evaluate(expr);
      if (ev.ok && ev.value !== null) {
        expr = name + "(" + String(Math.round(ev.value * 1e12) / 1e12) + ")";
        render();
        if (second) {
          second = false;
          updateSecondUi();
        }
        return;
      }
    }
    if (!expr || endsWithOp() || expr.endsWith("(")) {
      if (needsMulBefore() && !endsWithOp() && !expr.endsWith("(")) expr += "*";
      expr += name + "(";
    } else {
      const span = lastNumberSpan(expr);
      if (span && span.end === expr.length) {
        expr = expr.slice(0, span.start) + name + "(" + span.value + ")";
      } else if (expr.endsWith(")")) {
        expr = name + "(" + expr + ")";
      } else {
        if (needsMulBefore()) expr += "*";
        expr += name + "(";
      }
    }
    if (second) {
      second = false;
      updateSecondUi();
    }
    render();
  };

  const wrapUnary = (kind) => {
    const ev = evaluate(expr);
    if ((!expr || endsWithOp() || expr.endsWith("(")) && kind !== "fact") {
      shake();
      return;
    }
    if (kind === "square") {
      if (ev.ok && ev.value !== null && !ev.incomplete) expr = "(" + expr + ")^2";
      else {
        const span = lastNumberSpan(expr);
        if (span && span.end === expr.length) expr = expr.slice(0, span.start) + "(" + span.value + ")^2";
        else return shake();
      }
    } else if (kind === "cube") {
      if (ev.ok && ev.value !== null && !ev.incomplete) expr = "(" + expr + ")^3";
      else {
        const span = lastNumberSpan(expr);
        if (span && span.end === expr.length) expr = expr.slice(0, span.start) + "(" + span.value + ")^3";
        else return shake();
      }
    } else if (kind === "inv") {
      if (ev.ok && ev.value !== null && !ev.incomplete) expr = "1/(" + expr + ")";
      else return shake();
    } else if (kind === "fact") {
      if (expr.endsWith("!")) return;
      if (ev.ok && ev.value !== null && !ev.incomplete && !endsWithOp()) expr = "(" + expr + ")!";
      else {
        const span = lastNumberSpan(expr);
        if (span && span.end === expr.length) expr += "!";
        else return shake();
      }
    }
    justEquals = false;
    render();
  };

  const toggleSign = () => {
    if (!expr) {
      expr = "-";
      render();
      return;
    }
    const span = lastNumberSpan(expr);
    if (!span) return;
    const before = expr.slice(0, span.start);
    if (before.endsWith("(-")) {
      expr = before.slice(0, -2) + span.value + expr.slice(span.end);
    } else {
      expr = before + "(-" + span.value + ")" + expr.slice(span.end);
    }
    render();
  };

  const applyPercent = () => {
    const ev = evaluate(expr);
    if (!ev.ok || ev.value === null) {
      shake();
      return;
    }
    const m = expr.match(/^(.*?)([+\-*/])((?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?)$/i);
    if (m) {
      const left = evaluate(m[1]);
      const pct = Number(m[3]) / 100;
      if (!left.ok || left.value === null) return;
      const next = m[2] === "+" || m[2] === "-" ? left.value * pct : pct;
      expr = m[1] + m[2] + String(next);
    } else {
      expr = String(ev.value / 100);
    }
    justEquals = false;
    render();
  };

  const insertEE = () => {
    if (justEquals) {
      expr = String(ans) + "e";
      justEquals = false;
      render();
      return;
    }
    const span = lastNumberSpan(expr);
    if (!span || span.end !== expr.length || /e/i.test(span.value)) {
      shake();
      return;
    }
    expr += "e";
    render();
  };

  const currentValue = () => {
    const ev = evaluate(expr);
    if (ev.ok && ev.value !== null) return ev.value;
    return null;
  };

  const memoryAction = (kind) => {
    const val = currentValue();
    if (kind === "mc") {
      memory = 0;
      toast("Memory cleared");
    } else if (kind === "mr") {
      if (justEquals || !expr) {
        expr = String(memory);
        justEquals = false;
      } else if (endsWithOp() || expr.endsWith("(")) {
        expr += String(memory);
      } else {
        expr = String(memory);
      }
      render();
      toast("Memory recalled");
      updateMemBadge();
      return;
    } else if (kind === "ms") {
      if (val === null) return shake();
      memory = val;
      toast("Stored in memory");
    } else if (kind === "mplus") {
      if (val === null) return shake();
      memory += val;
      toast("M+");
    } else if (kind === "mminus") {
      if (val === null) return shake();
      memory -= val;
      toast("M−");
    }
    updateMemBadge();
  };

  const equals = () => {
    let work = expr;
    const ev0 = evaluate(work);
    if (justEquals && lastOp && lastOp.rhs !== null) {
      work = String(ev0.value) + lastOp.op + lastOp.rhs;
    }
    const ev = evaluate(work);
    if (!ev.ok || ev.value === null) {
      shake();
      hintEl.textContent = "Almost — finish the expression";
      return;
    }
    const match = work.match(/([+\-*/^%])((?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?|pi|e|ans)$/i);
    if (match) lastOp = { op: match[1], rhs: match[2] };
    history.unshift({ expr: work, value: ev.value });
    history = history.slice(0, 16);
    ans = ev.value;
    expr = String(Math.round(ev.value * 1e12) / 1e12);
    justEquals = true;
    render();
    pulse();
    hintEl.textContent = "Equals again to repeat · Ans holds result";
    paintHistory();
  };

  const back = () => {
    if (justEquals) justEquals = false;
    for (const name of [...FN_NAMES, ...CONST_NAMES].sort((a, b) => b.length - a.length)) {
      if (expr.endsWith(name)) {
        expr = expr.slice(0, -name.length);
        render();
        return;
      }
    }
    expr = expr.slice(0, -1);
    render();
  };

  const clearAll = () => {
    expr = "";
    justEquals = false;
    lastOp = null;
    hintEl.textContent = "Cleared · ready";
    render();
  };

  const copyResult = async () => {
    let text = null;
    if (activePanel === "currency") text = window.LumenFX?.copyValue?.();
    else if (activePanel === "units") text = window.LumenUnits?.copyValue?.();
    else if (activePanel === "programmer") text = window.LumenProg?.copyValue?.();
    else if (activePanel === "ai") text = window.LumenAI?.copyValue?.();
    else {
      const ev = evaluate(expr);
      text = ev.ok && ev.value !== null ? String(ev.value) : resultEl.textContent;
    }
    if (!text) {
      toast("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Result copied");
    } catch {
      toast("Could not copy");
    }
  };

  const paintHistory = () => {
    historyList.innerHTML = "";
    historyEmpty.hidden = history.length > 0;
    history.forEach((item) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `<div class="h-expr">${prettyExpr(item.expr)}</div><div class="h-val">${format(item.value)}</div>`;
      btn.addEventListener("click", () => {
        expr = String(item.value);
        ans = item.value;
        justEquals = true;
        render();
        historyPanel.hidden = true;
      });
      li.appendChild(btn);
      historyList.appendChild(li);
    });
  };

  const lightKey = (root, selector) => {
    const btn = root.querySelector(selector);
    if (!btn) return;
    btn.classList.add("lit");
    window.setTimeout(() => btn.classList.remove("lit"), 120);
  };

  const handlePadClick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.dataset.digit) insertDigit(btn.dataset.digit);
    else if (btn.dataset.op) insertOp(btn.dataset.op);
    else if (btn.dataset.key) {
      if (justEquals && btn.dataset.key === "(") {
        expr = "";
        justEquals = false;
      }
      if (needsMulBefore() && btn.dataset.key === "(") expr += "*";
      expr += btn.dataset.key;
      justEquals = false;
      render();
    } else if (btn.dataset.fn) {
      const name = second && btn.dataset.alt ? btn.dataset.alt : btn.dataset.fn;
      insertFn(name);
    } else if (btn.dataset.const) insertConst(btn.dataset.const);
    else if (btn.dataset.mem) memoryAction(btn.dataset.mem);
    else if (btn.dataset.act === "dot") insertDot();
    else if (btn.dataset.act === "clear") clearAll();
    else if (btn.dataset.act === "back") back();
    else if (btn.dataset.act === "equals") equals();
    else if (btn.dataset.act === "percent") applyPercent();
    else if (btn.dataset.act === "sign") toggleSign();
    else if (btn.dataset.act === "pow") insertOp("^");
    else if (btn.dataset.act === "mod") insertOp("%");
    else if (btn.dataset.act === "ee") insertEE();
    else if (btn.dataset.act === "square") wrapUnary("square");
    else if (btn.dataset.act === "cube") wrapUnary("cube");
    else if (btn.dataset.act === "inv") wrapUnary("inv");
    else if (btn.dataset.act === "fact") wrapUnary("fact");
    else if (btn.dataset.act === "ans") insertConst("ans");
    else if (btn.dataset.act === "rand") {
      if (justEquals || !expr) {
        expr = String(Math.random());
        justEquals = false;
      } else if (endsWithOp() || expr.endsWith("(")) {
        expr += String(Math.random());
      } else {
        expr = String(Math.random());
      }
      render();
    } else if (btn.dataset.act === "second") {
      second = !second;
      updateSecondUi();
    }
  };

  keysEl.addEventListener("click", handlePadClick);
  sciKeysEl.addEventListener("click", handlePadClick);
  memKeysEl.addEventListener("click", handlePadClick);

  modeBtn.addEventListener("click", () => {
    sciMode = !sciMode;
    chassis.classList.toggle("sci-mode", sciMode && activePanel === "calc");
    chassis.classList.toggle("wide", activePanel !== "calc" || sciMode);
    modeBtn.classList.toggle("active", sciMode);
    modeBtn.textContent = sciMode ? "Sci" : "Basic";
    toast(sciMode ? "Scientific pad on" : "Basic pad");
  });

  angleBtn.addEventListener("click", () => {
    angleMode = angleMode === "deg" ? "rad" : "deg";
    updateAngleUi();
    render();
    toast(angleMode === "deg" ? "Degrees" : "Radians");
  });

  document.getElementById("modeNav").addEventListener("click", (e) => {
    const tab = e.target.closest(".mode-tab");
    if (!tab) return;
    setPanel(tab.dataset.panel);
  });

  document.getElementById("copyBtn").addEventListener("click", copyResult);
  document.getElementById("historyBtn").addEventListener("click", () => {
    historyPanel.hidden = !historyPanel.hidden;
    if (!historyPanel.hidden) {
      const box = chassis.getBoundingClientRect();
      historyPanel.style.top = `${Math.max(16, box.top)}px`;
      historyPanel.style.left = `${Math.min(box.right + 16, window.innerWidth - 300)}px`;
      paintHistory();
    }
  });
  document.getElementById("clearHistory").addEventListener("click", () => {
    history = [];
    paintHistory();
  });

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyResult();
      }
      return;
    }

    if (activePanel !== "calc") return;

    const k = e.key;
    if (/^[0-9]$/.test(k)) {
      insertDigit(k);
      lightKey(keysEl, `[data-digit="${k}"]`);
    } else if ("+-*/".includes(k)) {
      insertOp(k);
      lightKey(keysEl, `[data-op="${k === "*" ? "\\*" : k}"]`);
    } else if (k === "^") {
      insertOp("^");
      lightKey(keysEl, '[data-act="pow"]');
    } else if (k === ".") {
      insertDot();
      lightKey(keysEl, '[data-act="dot"]');
    } else if (k === "Enter" || k === "=") {
      e.preventDefault();
      equals();
      lightKey(keysEl, '[data-act="equals"]');
    } else if (k === "Backspace") {
      e.preventDefault();
      back();
      lightKey(keysEl, '[data-act="back"]');
    } else if (k === "Escape") {
      clearAll();
      lightKey(keysEl, '[data-act="clear"]');
    } else if (k === "(" || k === ")") {
      if (justEquals && k === "(") {
        expr = "";
        justEquals = false;
      }
      if (needsMulBefore() && k === "(") expr += "*";
      expr += k;
      justEquals = false;
      render();
      lightKey(keysEl, `[data-key="${k}"]`);
    } else if (k === "%") {
      applyPercent();
      lightKey(keysEl, '[data-act="percent"]');
    } else if (k === "!") {
      wrapUnary("fact");
    } else if (k.toLowerCase() === "h") {
      document.getElementById("historyBtn").click();
    } else if (k.toLowerCase() === "d") {
      angleBtn.click();
    } else if (k.toLowerCase() === "s" && !e.shiftKey) {
      modeBtn.click();
    }
  });

  updateAngleUi();
  updateSecondUi();
  updateMemBadge();
  render();
  setPanel("calc");

  window.LumenFX?.init?.();
  window.LumenUnits?.init?.();
  window.LumenProg?.init?.();
  window.LumenAI?.init?.();
  window.LumenPicker?.enhanceAll?.();
})();
