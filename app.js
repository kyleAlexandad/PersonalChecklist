const STORAGE_KEY = "checklist-app-v1";

/** @typedef {{ id: string, title: string, dueDate: string | null, priority: 'low'|'medium'|'high', notes: string, completed: boolean, createdAt: string }} CheckItem */

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/** @returns {{ items: CheckItem[] }} */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return { items: [] };
    return { items: data.items.map(normalizeItem) };
  } catch {
    return { items: [] };
  }
}

/** @param {Partial<CheckItem>} raw */
function normalizeItem(raw) {
  const p = raw.priority === "high" || raw.priority === "low" ? raw.priority : "medium";
  return {
    id: typeof raw.id === "string" ? raw.id : uid(),
    title: typeof raw.title === "string" ? raw.title : "",
    dueDate: raw.dueDate == null || raw.dueDate === "" ? null : String(raw.dueDate),
    priority: p,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    completed: Boolean(raw.completed),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

/** @param {{ items: CheckItem[] }} state */
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
}

const priorityOrder = { high: 0, medium: 1, low: 2 };

const els = {
  formAdd: document.getElementById("formAdd"),
  inputTitle: document.getElementById("inputTitle"),
  inputDue: document.getElementById("inputDue"),
  inputPriority: document.getElementById("inputPriority"),
  inputNotes: document.getElementById("inputNotes"),
  inputSearch: document.getElementById("inputSearch"),
  inputSort: document.getElementById("inputSort"),
  list: document.getElementById("list"),
  stats: document.getElementById("stats"),
  tplItem: document.getElementById("tplItem"),
  btnTheme: document.getElementById("btnTheme"),
  btnExport: document.getElementById("btnExport"),
  importFile: document.getElementById("importFile"),
  modalEdit: document.getElementById("modalEdit"),
  formEdit: document.getElementById("formEdit"),
  editId: document.getElementById("editId"),
  editTitle: document.getElementById("editTitle"),
  editDue: document.getElementById("editDue"),
  editPriority: document.getElementById("editPriority"),
  editNotes: document.getElementById("editNotes"),
  editDone: document.getElementById("editDone"),
  editCancel: document.getElementById("editCancel"),
};

let state = loadState();
let filter = "all";
let searchQuery = "";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("checklist-theme", theme);
  els.btnTheme.textContent = theme === "dark" ? "Light" : "Dark";
}

function initTheme() {
  const stored = localStorage.getItem("checklist-theme");
  if (stored === "dark" || stored === "light") {
    applyTheme(stored);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

/** @param {CheckItem[]} items */
function sortItems(items) {
  const sort = els.inputSort.value;
  const copy = [...items];
  if (sort === "due") {
    copy.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sort === "priority") {
    copy.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  } else if (sort === "created") {
    copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else if (sort === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  }
  return copy;
}

/** @param {CheckItem} item */
function matchesSearch(item) {
  if (!searchQuery.trim()) return true;
  const q = searchQuery.trim().toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    item.notes.toLowerCase().includes(q)
  );
}

/** @param {CheckItem} item */
function matchesFilter(item) {
  if (filter === "active") return !item.completed;
  if (filter === "done") return item.completed;
  return true;
}

function getFilteredItems() {
  return sortItems(state.items.filter((i) => matchesFilter(i) && matchesSearch(i)));
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isOverdue(dueDate, completed) {
  if (!dueDate || completed) return false;
  return dueDate < todayISODate();
}

/** @param {CheckItem} item */
function formatDueLabel(item) {
  if (!item.dueDate) return "No date";
  const d = new Date(item.dueDate + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** @param {string} iso */
function formatCreated(iso) {
  const d = new Date(iso);
  return `Added ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

/** @param {CheckItem} item */
function renderItem(item) {
  const node = els.tplItem.content.firstElementChild.cloneNode(true);
  node.dataset.id = item.id;
  node.dataset.priority = item.priority;
  if (item.completed) node.classList.add("is-done");

  const cb = node.querySelector(".item__checkbox");
  cb.checked = item.completed;
  cb.setAttribute("aria-label", item.completed ? "Mark incomplete" : "Mark complete");

  const pr = node.querySelector(".item__priority");
  pr.dataset.priority = item.priority;
  pr.textContent = `${item.priority} priority`;

  const time = node.querySelector(".item__date");
  if (item.dueDate) {
    time.dateTime = item.dueDate;
    time.textContent = formatDueLabel(item);
    if (isOverdue(item.dueDate, item.completed)) time.classList.add("is-overdue");
  } else {
    time.textContent = "No due date";
    time.removeAttribute("datetime");
  }

  node.querySelector(".item__title").textContent = item.title;
  const notesEl = node.querySelector(".item__notes");
  notesEl.textContent = item.notes || "";

  node.querySelector(".item__created").textContent = formatCreated(item.createdAt);

  return node;
}

function render() {
  const items = getFilteredItems();
  els.list.innerHTML = "";

  const total = state.items.length;
  const done = state.items.filter((i) => i.completed).length;
  const active = total - done;
  els.stats.textContent = `${total} total · ${active} active · ${done} done`;

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent =
      total === 0
        ? "Nothing here yet. Add your first item above."
        : "No items match your search or filter.";
    els.list.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const item of items) {
    frag.appendChild(renderItem(item));
  }
  els.list.appendChild(frag);
}

function persist() {
  saveState(state);
  render();
}

els.formAdd.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = els.inputTitle.value.trim();
  if (!title) return;

  const item = normalizeItem({
    id: uid(),
    title,
    dueDate: els.inputDue.value || null,
    priority: els.inputPriority.value,
    notes: els.inputNotes.value.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  });

  state.items.unshift(item);
  els.formAdd.reset();
  els.inputPriority.value = "medium";
  persist();
  els.inputTitle.focus();
});

els.list.addEventListener("change", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement) || t.type !== "checkbox") return;
  const li = t.closest(".item");
  if (!li) return;
  const id = li.dataset.id;
  const item = state.items.find((i) => i.id === id);
  if (item) {
    item.completed = t.checked;
    persist();
  }
});

els.list.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn || !(btn instanceof HTMLElement)) return;
  const action = btn.dataset.action;
  const li = btn.closest(".item");
  if (!li) return;
  const id = li.dataset.id;
  if (action === "delete") {
    if (confirm("Remove this item?")) {
      state.items = state.items.filter((i) => i.id !== id);
      persist();
    }
  } else if (action === "edit") {
    const item = state.items.find((i) => i.id === id);
    if (item) openEdit(item);
  }
});

document.querySelectorAll(".segmented__btn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".segmented__btn").forEach((x) => x.classList.remove("is-active"));
    b.classList.add("is-active");
    filter = b.dataset.filter || "all";
    render();
  });
});

els.inputSearch.addEventListener("input", () => {
  searchQuery = els.inputSearch.value;
  render();
});

els.inputSort.addEventListener("change", () => render());

function openEdit(item) {
  els.editId.value = item.id;
  els.editTitle.value = item.title;
  els.editDue.value = item.dueDate || "";
  els.editPriority.value = item.priority;
  els.editNotes.value = item.notes;
  els.editDone.checked = item.completed;
  els.modalEdit.showModal();
  els.editTitle.focus();
}

els.formEdit.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = els.editId.value;
  const item = state.items.find((i) => i.id === id);
  if (!item) {
    els.modalEdit.close();
    return;
  }
  item.title = els.editTitle.value.trim();
  item.dueDate = els.editDue.value || null;
  item.priority = /** @type {'low'|'medium'|'high'} */ (els.editPriority.value);
  item.notes = els.editNotes.value.trim();
  item.completed = els.editDone.checked;
  els.modalEdit.close();
  persist();
});

els.editCancel.addEventListener("click", () => els.modalEdit.close());

els.btnTheme.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(cur === "dark" ? "light" : "dark");
});

els.btnExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ items: state.items, exportedAt: new Date().toISOString() }, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `checklist-backup-${todayISODate()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

els.importFile.addEventListener("change", async () => {
  const file = els.importFile.files?.[0];
  els.importFile.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const incoming = Array.isArray(data.items) ? data.items : [];
    if (incoming.length === 0) {
      alert("No items found in file.");
      return;
    }
    const merged = confirm(
      "Merge imported items with your current list? Cancel replaces the entire list."
    );
    const normalized = incoming.map((x) => normalizeItem(x));
    if (merged) {
      const ids = new Set(state.items.map((i) => i.id));
      for (const it of normalized) {
        if (ids.has(it.id)) it.id = uid();
        state.items.push(it);
      }
    } else {
      state.items = normalized;
    }
    persist();
  } catch {
    alert("Could not read that file. Use a JSON export from this app.");
  }
});

initTheme();
render();
