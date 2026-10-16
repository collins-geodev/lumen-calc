window.LumenUnits = (() => {
  const catEl = () => document.getElementById("unitCategory");
  const fromEl = () => document.getElementById("unitFrom");
  const toEl = () => document.getElementById("unitTo");
  const amountEl = () => document.getElementById("unitAmount");

  const tempToC = (v, from) => {
    if (from === "C") return v;
    if (from === "F") return ((v - 32) * 5) / 9;
    if (from === "K") return v - 273.15;
    if (from === "R") return ((v - 491.67) * 5) / 9;
    throw new Error("temp");
  };

  const tempFromC = (c, to) => {
    if (to === "C") return c;
    if (to === "F") return (c * 9) / 5 + 32;
    if (to === "K") return c + 273.15;
    if (to === "R") return ((c + 273.15) * 9) / 5;
    throw new Error("temp");
  };

  const convertValue = (value, category, from, to) => {
    const cat = window.LumenData.units[category];
    if (!cat) return NaN;
    if (cat.special === "temperature") {
      return tempFromC(tempToC(value, from), to);
    }
    const a = cat.items[from];
    const b = cat.items[to];
    if (!a || !b) return NaN;
    return (value * a.toBase) / b.toBase;
  };

  const format = (n) => {
    if (!Number.isFinite(n)) return "—";
    // Prefer 2 d.p.; keep more digits only when 2 d.p. would hide a non-zero value
    const asTwo = Number(n.toFixed(2));
    if (n !== 0 && asTwo === 0) {
      return n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      });
    }
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const fillUnits = () => {
    const key = catEl().value;
    const cat = window.LumenData.units[key];
    const opts = Object.entries(cat.items)
      .map(([id, u]) => `<option value="${id}">${u.label}</option>`)
      .join("");
    fromEl().innerHTML = opts;
    toEl().innerHTML = opts;
    const keys = Object.keys(cat.items);
    fromEl().value = keys[0];
    toEl().value = keys[1] || keys[0];
    window.LumenPicker?.enhance?.(fromEl());
    window.LumenPicker?.enhance?.(toEl());
    window.LumenPicker?.refresh?.(fromEl());
    window.LumenPicker?.refresh?.(toEl());
  };

  const paintTable = (value, category, from) => {
    const table = document.getElementById("unitTable");
    const cat = window.LumenData.units[category];
    const rows = Object.keys(cat.items)
      .filter((k) => k !== from)
      .slice(0, 8)
      .map((k) => {
        const v = convertValue(value, category, from, k);
        return `<div class="unit-row"><span>${cat.items[k].label}</span><strong>${format(v)}</strong></div>`;
      })
      .join("");
    table.innerHTML = rows;
  };

  const convert = () => {
    const category = catEl().value;
    const from = fromEl().value;
    const to = toEl().value;
    const amount = Number(amountEl().value);
    const result = convertValue(amount, category, from, to);
    document.getElementById("unitPairLabel").textContent = `${from} → ${to}`;
    document.getElementById("unitResult").textContent = format(result);
    document.getElementById("unitMeta").textContent =
      window.LumenData.units[category].special === "temperature"
        ? "Temperature formulas · not a simple scale factor"
        : "Exact factor conversion via SI base units";
    if (Number.isFinite(amount)) paintTable(amount, category, from);
  };

  const init = () => {
    catEl().innerHTML = Object.entries(window.LumenData.units)
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
      .join("");
    window.LumenPicker?.enhance?.(catEl());
    fillUnits();
    catEl().addEventListener("change", () => {
      fillUnits();
      convert();
    });
    ["unitAmount", "unitFrom", "unitTo"].forEach((id) => {
      document.getElementById(id).addEventListener("input", convert);
      document.getElementById(id).addEventListener("change", convert);
    });
    document.getElementById("unitSwap").addEventListener("click", () => {
      const t = fromEl().value;
      fromEl().value = toEl().value;
      toEl().value = t;
      window.LumenPicker?.refresh?.(fromEl());
      window.LumenPicker?.refresh?.(toEl());
      convert();
    });
    convert();
    window.LumenPicker?.enhanceAll?.();
  };

  const copyValue = () => {
    const t = document.getElementById("unitResult").textContent;
    return t && t !== "—" ? t : null;
  };

  const answerTempPrompt = (q) => {
    const m = q.match(/(-?\d+(?:\.\d+)?)\s*°?\s*([CFKR])\s*(?:to|in)\s*°?\s*([CFKR])/i);
    if (!m) return null;
    const v = Number(m[1]);
    const from = m[2].toUpperCase();
    const to = m[3].toUpperCase();
    const out = convertValue(v, "temperature", from, to);
    return {
      answer: `${format(out)} °${to}`,
      steps: [
        `Parsed temperature ${v} °${from}`,
        `Converted via Celsius bridge`,
        `Result: ${format(out)} °${to}`,
      ],
    };
  };

  return { init, convert, copyValue, convertValue, answerTempPrompt };
})();
