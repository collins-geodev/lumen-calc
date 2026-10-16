window.LumenFX = (() => {
  const CACHE_KEY = "lumen_fx_v1";
  const TTL_MS = 5 * 60 * 1000;
  let rates = { USD: 1 };
  let base = "USD";
  let updatedAt = 0;
  let timer = null;

  const toast = (msg) => window.LumenUI?.toast?.(msg);

  const formatFixed2 = (n) => {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatMoney = (n, code) => {
    if (!Number.isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${formatFixed2(n)} ${code}`;
    }
  };

  const labelFor = (code) => {
    const c = window.LumenData.currencies.find((x) => x.code === code);
    return c ? `${c.flag} ${c.code} — ${c.name}` : code;
  };

  const fillSelects = () => {
    const from = document.getElementById("fxFrom");
    const to = document.getElementById("fxTo");
    const html = window.LumenData.currencies
      .map((c) => `<option value="${c.code}">${c.flag} ${c.code} · ${c.country}</option>`)
      .join("");
    from.innerHTML = html;
    to.innerHTML = html;
    from.value = "USD";
    to.value = "EUR";
    window.LumenPicker?.enhance?.(from);
    window.LumenPicker?.enhance?.(to);
    window.LumenPicker?.refresh?.(from);
    window.LumenPicker?.refresh?.(to);
  };

  const setStatus = (text, live = false) => {
    const el = document.getElementById("fxStatus");
    const dot = document.getElementById("fxLiveDot");
    if (el) el.textContent = text;
    if (dot) dot.classList.toggle("on", live);
  };

  const convert = () => {
    const amount = Number(document.getElementById("fxAmount").value);
    const from = document.getElementById("fxFrom").value;
    const to = document.getElementById("fxTo").value;
    const out = document.getElementById("fxResult");
    const meta = document.getElementById("fxRateMeta");
    const pair = document.getElementById("fxPairLabel");
    pair.textContent = `${from} → ${to}`;

    if (!Number.isFinite(amount)) {
      out.textContent = "—";
      return;
    }
    if (!rates[from] || !rates[to]) {
      out.textContent = "Rate unavailable";
      meta.textContent = `${labelFor(from)} · try Sync`;
      return;
    }
    // rates are vs USD (or base)
    const inBase = amount / rates[from];
    const converted = inBase * rates[to];
    const unit = rates[to] / rates[from];
    out.textContent = formatMoney(converted, to);
    const when = updatedAt ? new Date(updatedAt).toLocaleString() : "—";
    meta.textContent = `1 ${from} = ${formatFixed2(unit)} ${to} · synced ${when}`;
  };

  const saveCache = () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ rates, base, updatedAt })
    );
  };

  const loadCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data?.rates?.USD && !data?.rates?.[data.base]) return false;
      rates = data.rates;
      base = data.base || "USD";
      updatedAt = data.updatedAt || 0;
      return true;
    } catch {
      return false;
    }
  };

  const fetchRates = async (force = false) => {
    if (!force && updatedAt && Date.now() - updatedAt < TTL_MS && rates.USD) {
      setStatus(`Live cache · ${Object.keys(rates).length} currencies`, true);
      convert();
      return true;
    }
    setStatus("Syncing live rates…", false);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data.result !== "success" || !data.rates) throw new Error("Bad payload");
      rates = { USD: 1, ...data.rates };
      base = "USD";
      updatedAt = Date.now();
      saveCache();
      const n = Object.keys(rates).length;
      setStatus(`Live · ${n} currencies · open.er-api`, true);
      convert();
      if (force) toast("FX rates synced");
      return true;
    } catch (err) {
      // fallback
      try {
        const res = await fetch("https://api.frankfurter.app/latest?from=USD");
        const data = await res.json();
        rates = { USD: 1, ...data.rates };
        base = "USD";
        updatedAt = Date.now();
        saveCache();
        setStatus(`Live · Frankfurter · ${Object.keys(rates).length} currencies`, true);
        convert();
        if (force) toast("FX synced (fallback)");
        return true;
      } catch {
        if (loadCache()) {
          setStatus("Offline cache · tap Sync when online", false);
          convert();
          toast("Using cached FX rates");
          return false;
        }
        setStatus("Could not sync · check network", false);
        toast("FX sync failed");
        return false;
      }
    }
  };

  const paintPopular = () => {
    const row = document.getElementById("fxPopular");
    const popular = ["EUR", "GBP", "JPY", "NGN", "INR", "CAD", "AUD", "CNY", "BRL", "ZAR"];
    row.innerHTML = popular
      .map((code) => {
        const c = window.LumenData.currencies.find((x) => x.code === code);
        return `<button type="button" data-to="${code}">${c?.flag || ""} ${code}</button>`;
      })
      .join("");
    row.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-to]");
      if (!btn) return;
      const to = document.getElementById("fxTo");
      to.value = btn.dataset.to;
      window.LumenPicker?.refresh?.(to);
      convert();
    });
  };

  const init = () => {
    fillSelects();
    paintPopular();
    loadCache();
    ["fxAmount", "fxFrom", "fxTo"].forEach((id) => {
      document.getElementById(id).addEventListener("input", convert);
      document.getElementById(id).addEventListener("change", convert);
    });
    document.getElementById("fxSwap").addEventListener("click", () => {
      const a = document.getElementById("fxFrom");
      const b = document.getElementById("fxTo");
      const t = a.value;
      a.value = b.value;
      b.value = t;
      window.LumenPicker?.refresh?.(a);
      window.LumenPicker?.refresh?.(b);
      convert();
    });
    document.getElementById("fxRefreshBtn").addEventListener("click", () => fetchRates(true));
    convert();
    fetchRates(false);
    if (timer) clearInterval(timer);
    timer = setInterval(() => fetchRates(false), TTL_MS);
    window.LumenPicker?.enhanceAll?.();
  };

  const copyValue = () => {
    const t = document.getElementById("fxResult").textContent;
    return t && t !== "—" ? t : null;
  };

  return { init, fetchRates, convert, copyValue };
})();
