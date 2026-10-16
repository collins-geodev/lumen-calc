window.LumenPicker = (() => {
  const instances = new Map();

  const closeAll = (except) => {
    instances.forEach((api, el) => {
      if (el !== except) api.close();
    });
  };

  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const searchHint = (select) => {
    if (select.id === "fxFrom" || select.id === "fxTo") return "Search country or currency…";
    if (select.id === "unitCategory") return "Search category…";
    if (select.id === "unitFrom" || select.id === "unitTo") return "Search unit…";
    return "Type to search…";
  };

  const matches = (text, value, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = `${text} ${value}`.toLowerCase();
    return q.split(/\s+/).every((part) => hay.includes(part));
  };

  const enhance = (select) => {
    if (!select || !(select instanceof HTMLSelectElement)) return;
    if (select.dataset.picker === "on" && select.closest(".picker")) {
      instances.get(select)?.syncLabel?.();
      return;
    }

    if (select.dataset.picker === "on" && !select.closest(".picker")) {
      delete select.dataset.picker;
    }

    select.dataset.picker = "on";
    select.classList.add("picker-native");

    const parent = select.parentNode;
    if (!parent) return;

    const wrap = document.createElement("div");
    wrap.className = "picker";
    parent.insertBefore(wrap, select);
    wrap.appendChild(select);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "picker-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `<span class="label"></span><span class="caret" aria-hidden="true">▾</span>`;

    const menu = document.createElement("div");
    menu.className = "picker-menu";
    menu.innerHTML = `
      <div class="picker-search-wrap">
        <span class="picker-search-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <path d="M16 16l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </span>
        <input type="search" class="picker-search" placeholder="${escapeHtml(searchHint(select))}" autocomplete="off" spellcheck="false" />
      </div>
      <p class="picker-count" aria-live="polite"></p>
      <div class="picker-list" role="listbox"></div>
    `;

    wrap.appendChild(trigger);
    wrap.appendChild(menu);

    const labelEl = trigger.querySelector(".label");
    const searchEl = menu.querySelector(".picker-search");
    const listEl = menu.querySelector(".picker-list");
    const countEl = menu.querySelector(".picker-count");
    let activeIndex = -1;

    const syncLabel = () => {
      const opt = select.selectedOptions[0];
      labelEl.textContent = opt ? opt.textContent : "Select…";
    };

    const optionData = () =>
      [...select.options].map((opt) => ({
        value: opt.value,
        text: opt.textContent,
        disabled: opt.disabled,
      }));

    const setActive = (index) => {
      const buttons = [...listEl.querySelectorAll(".picker-option:not([disabled])")];
      if (!buttons.length) {
        activeIndex = -1;
        return;
      }
      activeIndex = ((index % buttons.length) + buttons.length) % buttons.length;
      buttons.forEach((btn, i) => btn.classList.toggle("active", i === activeIndex));
      buttons[activeIndex]?.scrollIntoView({ block: "nearest" });
    };

    const paintList = (filter = "") => {
      const q = filter.trim();
      const items = optionData().filter((o) => matches(o.text, o.value, q));
      const total = select.options.length;
      countEl.textContent = q
        ? `${items.length} match${items.length === 1 ? "" : "es"}`
        : `${total} options · type to filter`;

      if (!items.length) {
        listEl.innerHTML = `<p class="picker-empty">No matches for “${escapeHtml(q)}”</p>`;
        activeIndex = -1;
        return;
      }

      listEl.innerHTML = items
        .map((o) => {
          const selected = o.value === select.value ? " selected" : "";
          return `<button type="button" class="picker-option${selected}" role="option" data-value="${escapeHtml(o.value)}" ${o.disabled ? "disabled" : ""}>${escapeHtml(o.text)}</button>`;
        })
        .join("");

      const selectedBtn = listEl.querySelector(".picker-option.selected");
      const buttons = [...listEl.querySelectorAll(".picker-option:not([disabled])")];
      activeIndex = selectedBtn ? buttons.indexOf(selectedBtn) : 0;
      if (activeIndex >= 0) setActive(activeIndex);
    };

    const open = () => {
      closeAll(select);
      wrap.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      searchEl.value = "";
      paintList();
      window.setTimeout(() => {
        searchEl.focus();
        searchEl.select();
      }, 0);
    };

    const close = () => {
      wrap.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    };

    const setValue = (value, emit = true) => {
      if (select.value !== value) select.value = value;
      syncLabel();
      close();
      if (emit) {
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    trigger.addEventListener("click", () => {
      if (wrap.classList.contains("open")) close();
      else open();
    });

    searchEl.addEventListener("input", () => {
      paintList(searchEl.value);
      setActive(0);
    });

    searchEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        trigger.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(activeIndex < 0 ? 0 : activeIndex + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(activeIndex < 0 ? 0 : activeIndex - 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const buttons = [...listEl.querySelectorAll(".picker-option:not([disabled])")];
        const btn = buttons[activeIndex] || buttons[0];
        if (btn) setValue(btn.dataset.value);
      }
    });

    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".picker-option");
      if (!btn || btn.disabled) return;
      setValue(btn.dataset.value);
    });

    listEl.addEventListener("mousemove", (e) => {
      const btn = e.target.closest(".picker-option");
      if (!btn || btn.disabled) return;
      const buttons = [...listEl.querySelectorAll(".picker-option:not([disabled])")];
      const idx = buttons.indexOf(btn);
      if (idx >= 0) setActive(idx);
    });

    select.addEventListener("change", syncLabel);

    const mo = new MutationObserver(() => {
      syncLabel();
      if (wrap.classList.contains("open")) paintList(searchEl.value);
    });
    mo.observe(select, { childList: true, subtree: true, attributes: true });

    syncLabel();
    instances.set(select, { open, close, syncLabel, setValue });
  };

  const enhanceAll = (root = document) => {
    root.querySelectorAll("select").forEach(enhance);
  };

  const refresh = (select) => {
    const api = instances.get(select);
    if (api) api.syncLabel();
  };

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".picker")) closeAll();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });

  const boot = () => {
    try {
      enhanceAll(document);
    } catch (err) {
      console.error("LumenPicker boot failed", err);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener("load", boot, { once: true });

  return { enhance, enhanceAll, refresh, closeAll, boot };
})();
