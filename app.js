(() => {
  const STORAGE_KEY = "monthly-bill-checklist:v1";

  const DEFAULT_BILLS = [
    { id: "rent", name: "Rent", amount: 2100 },
    { id: "car-insurance", name: "Car Insurance", amount: 300 },
    { id: "water", name: "Water Bill", amount: 150 },
    { id: "internet", name: "Internet", amount: 100 },
    { id: "verizon", name: "Verizon", amount: 300 },
    { id: "txu", name: "TXU", amount: 350 },
  ];

  const SPEND_KEYS = ["entertainment", "fuel", "groceries"];

  const money = (n, { cents = false } = {}) =>
    "$" +
    Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    });

  const currentMonthValue = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const emptySpendBucket = () => ({ entries: [] });

  const emptyMonthState = () => ({
    bills: DEFAULT_BILLS.map((b) => ({
      id: b.id,
      dueDate: "",
      paid: false,
      datePaid: "",
      notes: "",
    })),
    truck: [
      { id: "p1", label: "Payment #1", paid: false, date: "" },
      { id: "p2", label: "Payment #2", paid: false, date: "" },
    ],
    rac: [
      { id: "w1", label: "Week 1", paid: false, date: "" },
      { id: "w2", label: "Week 2", paid: false, date: "" },
      { id: "w3", label: "Week 3", paid: false, date: "" },
      { id: "w4", label: "Week 4", paid: false, date: "" },
    ],
    spending: {
      entertainment: emptySpendBucket(),
      fuel: emptySpendBucket(),
      groceries: emptySpendBucket(),
    },
    notes: "",
  });

  const normalizeMonth = (month) => {
    const base = emptyMonthState();
    if (!month || typeof month !== "object") return base;
    return {
      bills: Array.isArray(month.bills) ? month.bills : base.bills,
      truck: Array.isArray(month.truck) ? month.truck : base.truck,
      rac: Array.isArray(month.rac) ? month.rac : base.rac,
      spending: {
        entertainment: {
          entries: Array.isArray(month.spending?.entertainment?.entries)
            ? month.spending.entertainment.entries
            : [],
        },
        fuel: {
          entries: Array.isArray(month.spending?.fuel?.entries)
            ? month.spending.fuel.entries
            : [],
        },
        groceries: {
          entries: Array.isArray(month.spending?.groceries?.entries)
            ? month.spending.groceries.entries
            : [],
        },
      },
      notes: typeof month.notes === "string" ? month.notes : "",
    };
  };

  const loadAll = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { activeMonth: currentMonthValue(), months: {} };
      const parsed = JSON.parse(raw);
      const months = {};
      Object.entries(parsed.months || {}).forEach(([key, value]) => {
        months[key] = normalizeMonth(value);
      });
      return {
        activeMonth: parsed.activeMonth || currentMonthValue(),
        months,
      };
    } catch {
      return { activeMonth: currentMonthValue(), months: {} };
    }
  };

  let store = loadAll();

  const ensureMonth = (month) => {
    if (!store.months[month]) {
      store.months[month] = emptyMonthState();
    } else {
      store.months[month] = normalizeMonth(store.months[month]);
    }
    return store.months[month];
  };

  let storageOk = true;
  const persist = () => {
    if (!storageOk) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeMonth: store.activeMonth,
          months: store.months,
        })
      );
    } catch {
      storageOk = false;
      const hint = document.querySelector(".save-hint");
      if (hint) {
        hint.textContent =
          "Saving is unavailable in this browser mode — checklist won’t persist after you leave.";
      }
    }
  };

  const els = {
    monthSelect: document.getElementById("month-select"),
    billsBody: document.getElementById("bills-body"),
    truckItems: document.getElementById("truck-items"),
    racItems: document.getElementById("rac-items"),
    notesArea: document.getElementById("notes-area"),
    btnNewMonth: document.getElementById("btn-new-month"),
    confirmReset: document.getElementById("confirm-reset"),
    spendLists: {
      entertainment: document.getElementById("spend-entertainment"),
      fuel: document.getElementById("spend-fuel"),
      groceries: document.getElementById("spend-groceries"),
    },
  };

  if (
    !els.monthSelect ||
    !els.billsBody ||
    !els.truckItems ||
    !els.racItems ||
    !els.notesArea ||
    !els.btnNewMonth ||
    !els.confirmReset ||
    !els.spendLists.entertainment ||
    !els.spendLists.fuel ||
    !els.spendLists.groceries
  ) {
    return;
  }

  const supportsDialog =
    typeof HTMLDialogElement === "function" &&
    typeof els.confirmReset.showModal === "function";

  let dialogScrim = null;
  if (!supportsDialog) {
    els.confirmReset.classList.add("dialog-fallback");
    els.confirmReset.setAttribute("hidden", "");
    dialogScrim = document.createElement("button");
    dialogScrim.type = "button";
    dialogScrim.className = "dialog-scrim";
    dialogScrim.setAttribute("aria-label", "Close dialog");
    dialogScrim.hidden = true;
    document.body.appendChild(dialogScrim);
  }

  const openConfirm = () => {
    if (supportsDialog) {
      els.confirmReset.showModal();
      return;
    }
    els.confirmReset.returnValue = "";
    els.confirmReset.removeAttribute("hidden");
    if (dialogScrim) dialogScrim.hidden = false;
  };

  const closeConfirm = (value) => {
    if (supportsDialog) return;
    els.confirmReset.returnValue = value || "cancel";
    els.confirmReset.setAttribute("hidden", "");
    if (dialogScrim) dialogScrim.hidden = true;
    els.confirmReset.dispatchEvent(new Event("close"));
  };

  const state = () => ensureMonth(store.activeMonth);

  const escapeAttr = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const newEntryId = () =>
    `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const spendTotal = (key) =>
    (state().spending[key]?.entries || []).reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );

  const renderBills = () => {
    const s = state();
    els.billsBody.innerHTML = DEFAULT_BILLS.map((bill) => {
      const row = s.bills.find((b) => b.id === bill.id) || {
        dueDate: "",
        paid: false,
        datePaid: "",
        notes: "",
      };
      return `
        <tr class="${row.paid ? "paid-row" : ""}" data-bill="${bill.id}">
          <td>
            <input
              class="cell-input"
              type="date"
              data-field="dueDate"
              value="${row.dueDate || ""}"
              aria-label="${bill.name} due date"
            />
          </td>
          <td class="bill-name">${bill.name}</td>
          <td class="amount">${money(bill.amount)}</td>
          <td>
            <input
              class="paid-check"
              type="checkbox"
              data-field="paid"
              ${row.paid ? "checked" : ""}
              aria-label="${bill.name} paid"
            />
          </td>
          <td>
            <input
              class="cell-input"
              type="date"
              data-field="datePaid"
              value="${row.datePaid || ""}"
              aria-label="${bill.name} date paid"
            />
          </td>
          <td>
            <input
              class="cell-input notes-input"
              type="text"
              data-field="notes"
              value="${escapeAttr(row.notes || "")}"
              placeholder="…"
              aria-label="${bill.name} notes"
            />
          </td>
        </tr>
      `;
    }).join("");
  };

  const renderSpecialty = (container, items, group) => {
    container.innerHTML = items
      .map(
        (item) => `
      <div class="specialty-item ${item.paid ? "is-paid" : ""}" data-group="${group}" data-id="${item.id}">
        <input
          class="paid-check"
          type="checkbox"
          data-field="paid"
          ${item.paid ? "checked" : ""}
          id="${group}-${item.id}"
          aria-label="${item.label} paid"
        />
        <label for="${group}-${item.id}">${item.label}</label>
        <div class="date-row">
          <span>Date:</span>
          <input
            type="date"
            data-field="date"
            value="${item.date || ""}"
            aria-label="${item.label} date"
          />
        </div>
      </div>
    `
      )
      .join("");
  };

  const renderSpending = (key) => {
    const list = els.spendLists[key];
    const card = list.closest(".spending-card");
    const entries = state().spending[key].entries;
    const totalEl = card.querySelector("[data-spend-total]");
    totalEl.textContent = money(spendTotal(key), { cents: true });

    if (!entries.length) {
      list.innerHTML = `<p class="spend-empty">No entries yet — add what you spend.</p>`;
      return;
    }

    list.innerHTML = entries
      .map(
        (entry) => `
      <div class="spend-entry" data-spend-key="${key}" data-entry-id="${entry.id}">
        <input
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          data-field="amount"
          value="${entry.amount === "" || entry.amount == null ? "" : entry.amount}"
          placeholder="$0.00"
          aria-label="Amount"
        />
        <input
          type="text"
          data-field="note"
          value="${escapeAttr(entry.note || "")}"
          placeholder="What for?"
          aria-label="Note"
        />
        <button type="button" class="btn-remove-spend" data-remove title="Remove">✕</button>
        <div class="spend-meta">
          <input
            type="date"
            data-field="date"
            value="${entry.date || ""}"
            aria-label="Date spent"
          />
        </div>
      </div>
    `
      )
      .join("");
  };

  const renderAllSpending = () => {
    SPEND_KEYS.forEach(renderSpending);
  };

  const renderAll = () => {
    els.monthSelect.value = store.activeMonth;
    const s = state();
    renderBills();
    renderSpecialty(els.truckItems, s.truck, "truck");
    renderSpecialty(els.racItems, s.rac, "rac");
    renderAllSpending();
    els.notesArea.value = s.notes || "";
  };

  const getBillRow = (id) => {
    const s = state();
    let row = s.bills.find((b) => b.id === id);
    if (!row) {
      row = { id, dueDate: "", paid: false, datePaid: "", notes: "" };
      s.bills.push(row);
    }
    return row;
  };

  const findEntry = (key, id) =>
    state().spending[key].entries.find((e) => e.id === id);

  els.billsBody.addEventListener("change", (e) => {
    const target = e.target;
    const tr = target.closest("tr[data-bill]");
    if (!tr) return;
    const id = tr.dataset.bill;
    const field = target.dataset.field;
    const row = getBillRow(id);

    if (field === "paid") {
      row.paid = target.checked;
      if (row.paid && !row.datePaid) {
        row.datePaid = new Date().toISOString().slice(0, 10);
      }
    } else if (field) {
      row[field] = target.value;
    }
    persist();
    renderBills();
  });

  els.billsBody.addEventListener("input", (e) => {
    const target = e.target;
    if (target.dataset.field !== "notes") return;
    const tr = target.closest("tr[data-bill]");
    if (!tr) return;
    getBillRow(tr.dataset.bill).notes = target.value;
    persist();
  });

  const onSpecialtyChange = (e) => {
    const itemEl = e.target.closest(".specialty-item");
    if (!itemEl) return;
    const group = itemEl.dataset.group;
    const id = itemEl.dataset.id;
    const field = e.target.dataset.field;
    if (!field) return;

    const list = state()[group];
    const item = list.find((x) => x.id === id);
    if (!item) return;

    if (field === "paid") {
      item.paid = e.target.checked;
      if (item.paid && !item.date) {
        item.date = new Date().toISOString().slice(0, 10);
      }
    } else if (field === "date") {
      item.date = e.target.value;
    }
    persist();
    renderSpecialty(
      group === "truck" ? els.truckItems : els.racItems,
      list,
      group
    );
  };

  els.truckItems.addEventListener("change", onSpecialtyChange);
  els.racItems.addEventListener("change", onSpecialtyChange);

  const spendingRow = document.querySelector(".spending-row");
  if (!spendingRow) return;

  spendingRow.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-spend-add]");
    if (addBtn) {
      const key = addBtn.dataset.spendAdd;
      state().spending[key].entries.push({
        id: newEntryId(),
        amount: "",
        note: "",
        date: new Date().toISOString().slice(0, 10),
      });
      persist();
      renderSpending(key);
      const list = els.spendLists[key];
      const amountInput = list.querySelector(
        ".spend-entry:last-child input[data-field='amount']"
      );
      if (amountInput) amountInput.focus();
      return;
    }

    const removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      const row = removeBtn.closest(".spend-entry");
      const key = row.dataset.spendKey;
      const id = row.dataset.entryId;
      state().spending[key].entries = state().spending[key].entries.filter(
        (x) => x.id !== id
      );
      persist();
      renderSpending(key);
    }
  });

  spendingRow.addEventListener("input", (e) => {
    const row = e.target.closest(".spend-entry");
    if (!row) return;
    const field = e.target.dataset.field;
    if (!field) return;
    const entry = findEntry(row.dataset.spendKey, row.dataset.entryId);
    if (!entry) return;

    if (field === "amount") {
      entry.amount = e.target.value === "" ? "" : Number(e.target.value);
      const card = row.closest(".spending-card");
      card.querySelector("[data-spend-total]").textContent = money(
        spendTotal(row.dataset.spendKey),
        { cents: true }
      );
    } else {
      entry[field] = e.target.value;
    }
    persist();
  });

  spendingRow.addEventListener("change", (e) => {
    const row = e.target.closest(".spend-entry");
    if (!row || e.target.dataset.field !== "date") return;
    const entry = findEntry(row.dataset.spendKey, row.dataset.entryId);
    if (!entry) return;
    entry.date = e.target.value;
    persist();
  });

  els.notesArea.addEventListener("input", () => {
    state().notes = els.notesArea.value;
    persist();
  });

  els.monthSelect.addEventListener("change", () => {
    store.activeMonth = els.monthSelect.value || currentMonthValue();
    ensureMonth(store.activeMonth);
    persist();
    renderAll();
  });

  els.btnNewMonth.addEventListener("click", () => {
    openConfirm();
  });

  if (!supportsDialog) {
    els.confirmReset.addEventListener("click", (e) => {
      const btn = e.target.closest("button[value]");
      if (!btn) return;
      e.preventDefault();
      closeConfirm(btn.value);
    });
    if (dialogScrim) {
      dialogScrim.addEventListener("click", () => closeConfirm("cancel"));
    }
  }

  els.confirmReset.addEventListener("close", () => {
    if (els.confirmReset.returnValue !== "confirm") return;
    const fresh = emptyMonthState();
    const prev = state();
    fresh.bills = fresh.bills.map((b) => {
      const old = prev.bills.find((x) => x.id === b.id);
      return { ...b, dueDate: (old && old.dueDate) || "" };
    });
    store.months[store.activeMonth] = fresh;
    persist();
    renderAll();
  });

  ensureMonth(store.activeMonth);
  renderAll();
})();
