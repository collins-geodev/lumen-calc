window.LumenProg = (() => {
  const MASK = 0xffffffff;
  let base = 16;
  let value = 0;
  let entry = "0";
  let op = null;
  let left = null;
  let fresh = true;

  const clamp = (n) => (n | 0) >>> 0;

  const parseEntry = () => {
    if (!entry || entry === "-") return 0;
    const n = parseInt(entry, base);
    if (Number.isNaN(n)) return value;
    return clamp(n);
  };

  const format = (n, b = base) => {
    const u = clamp(n);
    if (b === 2) return u.toString(2).padStart(8, "0").replace(/(.{4})/g, "$1 ").trim();
    if (b === 8) return u.toString(8);
    if (b === 16) return u.toString(16).toUpperCase();
    return (u > 0x7fffffff ? u - 0x100000000 : u).toString(10);
  };

  const signedDec = (n) => {
    const u = clamp(n);
    return u > 0x7fffffff ? u - 0x100000000 : u;
  };

  const render = () => {
    document.getElementById("progDisplay").textContent = fresh ? format(value) : entry.toUpperCase();
    document.getElementById("progHex").textContent = format(value, 16);
    document.getElementById("progDec").textContent = String(signedDec(value));
    document.getElementById("progOct").textContent = format(value, 8);
    document.getElementById("progBin").textContent = format(value, 2);
    document.getElementById("progKeys").dataset.base = String(base);
    document.querySelectorAll("#progBaseSeg button").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.base) === base);
    });
    document.getElementById("progHint").textContent =
      `Base ${base} · 32-bit · ${op ? "op pending" : "ready"} · two’s complement`;
  };

  const setBase = (b) => {
    value = parseEntry();
    base = b;
    entry = format(value, base).replace(/\s/g, "");
    if (base === 10) entry = String(signedDec(value));
    fresh = true;
    render();
  };

  const digitOk = (d) => {
    const map = { 2: "01", 8: "01234567", 10: "0123456789", 16: "0123456789ABCDEF" };
    return map[base].includes(d.toUpperCase());
  };

  const applyOp = (a, operator, b) => {
    a = clamp(a);
    b = clamp(b);
    switch (operator) {
      case "add":
        return clamp(a + b);
      case "sub":
        return clamp(a - b);
      case "mul":
        return clamp(Math.imul(a, b));
      case "div":
        if (b === 0) throw new Error("div0");
        return clamp(Math.trunc(signedDec(a) / signedDec(b)));
      case "mod":
        if (b === 0) throw new Error("div0");
        return clamp(signedDec(a) % signedDec(b));
      case "and":
        return clamp(a & b);
      case "or":
        return clamp(a | b);
      case "xor":
        return clamp(a ^ b);
      case "nand":
        return clamp(~(a & b));
      case "nor":
        return clamp(~(a | b));
      case "shl":
        return clamp(a << (b & 31));
      case "shr":
        return clamp(a >>> (b & 31));
      default:
        return b;
    }
  };

  const commitOp = (nextOp) => {
    const rhs = parseEntry();
    if (op && left !== null) {
      try {
        value = applyOp(left, op, rhs);
      } catch {
        window.LumenUI?.toast?.("Divide by zero");
        return;
      }
    } else {
      value = rhs;
    }
    left = value;
    op = nextOp;
    entry = format(value, base).replace(/\s/g, "");
    if (base === 10) entry = String(signedDec(value));
    fresh = true;
    render();
  };

  const equals = () => {
    const rhs = parseEntry();
    if (op && left !== null) {
      try {
        value = applyOp(left, op, rhs);
      } catch {
        window.LumenUI?.toast?.("Divide by zero");
        return;
      }
    } else value = rhs;
    op = null;
    left = null;
    entry = format(value, base).replace(/\s/g, "");
    if (base === 10) entry = String(signedDec(value));
    fresh = true;
    render();
  };

  const handle = (act, val) => {
    if (act === "digit") {
      if (!digitOk(val)) return;
      if (fresh) {
        entry = val.toUpperCase();
        fresh = false;
      } else {
        if (entry === "0") entry = val.toUpperCase();
        else entry += val.toUpperCase();
      }
      value = parseEntry();
      render();
      return;
    }
    if (act === "clear") {
      value = 0;
      entry = "0";
      op = null;
      left = null;
      fresh = true;
      render();
      return;
    }
    if (act === "back") {
      if (fresh) return;
      entry = entry.slice(0, -1) || "0";
      value = parseEntry();
      render();
      return;
    }
    if (act === "neg") {
      value = clamp(-signedDec(parseEntry()));
      entry = base === 10 ? String(signedDec(value)) : format(value, base).replace(/\s/g, "");
      fresh = true;
      render();
      return;
    }
    if (act === "not") {
      value = clamp(~parseEntry());
      entry = base === 10 ? String(signedDec(value)) : format(value, base).replace(/\s/g, "");
      fresh = true;
      op = null;
      left = null;
      render();
      return;
    }
    if (act === "equals") {
      equals();
      return;
    }
    if (["add", "sub", "mul", "div", "mod", "and", "or", "xor", "nand", "nor", "shl", "shr"].includes(act)) {
      commitOp(act);
    }
  };

  const init = () => {
    document.getElementById("progBaseSeg").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-base]");
      if (!btn) return;
      setBase(Number(btn.dataset.base));
    });
    document.querySelectorAll(".base-row").forEach((row) => {
      row.addEventListener("click", () => setBase(Number(row.dataset.setBase)));
    });
    document.getElementById("progKeys").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-prog]");
      if (!btn) return;
      handle(btn.dataset.prog, btn.dataset.val);
    });
    render();
  };

  const copyValue = () => document.getElementById("progDisplay").textContent;

  return { init, copyValue, handle };
})();
