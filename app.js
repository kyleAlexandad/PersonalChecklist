const STORAGE_KEY = "checklist-app-v1";
const BACKUP_PREFIX = "CL1:";

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

function encodeBackupCode() {
  const payload = JSON.stringify({
    v: 1,
    exportedAt: new Date().toISOString(),
    items: state.items,
  });
  const b64 = btoa(unescape(encodeURIComponent(payload)));
  return BACKUP_PREFIX + b64;
}

function stripInvisible(s) {
  return String(s).replace(/\u200b|\ufeff/g, "");
}

/** @param {string} b64 */
function padBase64(b64) {
  const pad = b64.length % 4;
  if (pad === 0) return b64;
  return b64 + "=".repeat(4 - pad);
}

/**
 * @param {string} raw
 * @returns {CheckItem[]}
 */
function decodeBackupText(raw) {
  const trimmed = stripInvisible(raw).trim();
  if (!trimmed) throw new Error("Paste your backup code or JSON.");

  if (trimmed.startsWith("{")) {
    const data = JSON.parse(trimmed);
    if (!Array.isArray(data.items)) throw new Error('JSON must contain an "items" array.');
    return data.items;
  }

  let compact = stripInvisible(raw)
    .replace(/\s+/g, "")
    .replace(/：/g, ":");
  if (!compact.startsWith(BACKUP_PREFIX)) {
    throw new Error(
      'Backup must start with CL1: (use a normal colon ":") or paste JSON starting with {.'
    );
  }
  let b64 = compact.slice(BACKUP_PREFIX.length);
  b64 = padBase64(b64);
  let json;
  try {
    json = decodeURIComponent(escape(atob(b64)));
  } catch {
    throw new Error(
      "Could not decode this backup. Copy the full line after CL1: with nothing missing, or use File ↓ / File ↑."
    );
  }
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Decoded backup was not valid JSON.");
  }
  if (!data || !Array.isArray(data.items)) throw new Error("Invalid backup data (missing items array).");
  return data.items;
}

/** @param {Partial<CheckItem>[]} rawItems */
function applyImportedItems(rawItems) {
  const incoming = rawItems.map((x) => normalizeItem(x));
  if (incoming.length === 0) {
    if (!confirm("This backup has no tasks. Replace your list with an empty list?")) return;
    state.items = [];
    persist();
    return;
  }
  const merged = confirm(
    "Merge imported items with your current list? Cancel replaces the entire list."
  );
  if (merged) {
    const ids = new Set(state.items.map((i) => i.id));
    for (const it of incoming) {
      if (ids.has(it.id)) it.id = uid();
      state.items.push(it);
    }
  } else {
    state.items = incoming;
  }
  persist();
}

function flashButtonLabel(btn, label, ms = 2000) {
  const prev = btn.textContent;
  btn.textContent = label;
  window.setTimeout(() => {
    btn.textContent = prev;
  }, ms);
}

async function copyBackupToClipboard() {
  const text = encodeBackupCode();
  const tryExecCommandCopy = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      flashButtonLabel(els.btnCopyBackup, "Copied!");
      return;
    } catch (err) {
      console.warn(err);
    }
  }

  if (tryExecCommandCopy()) {
    flashButtonLabel(els.btnCopyBackup, "Copied!");
    return;
  }

  els.pasteBackup.value = text;
  els.pasteError.textContent =
    "Select the text below and copy (Ctrl+C). Clipboard API needs HTTPS or permission.";
  els.modalPaste.showModal();
  els.pasteBackup.focus();
  els.pasteBackup.select();
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
  btnCopyBackup: document.getElementById("btnCopyBackup"),
  btnPasteBackup: document.getElementById("btnPasteBackup"),
  btnDownloadFile: document.getElementById("btnDownloadFile"),
  importFile: document.getElementById("importFile"),
  modalPaste: document.getElementById("modalPaste"),
  pasteBackup: document.getElementById("pasteBackup"),
  pasteError: document.getElementById("pasteError"),
  pasteCancel: document.getElementById("pasteCancel"),
  pasteSubmit: document.getElementById("pasteSubmit"),
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
  try {
    localStorage.setItem("checklist-theme", theme);
  } catch (_) {
    /* private mode or quota */
  }
  const label = theme === "dark" ? "Light" : "Dark";
  if (els.btnTheme) els.btnTheme.textContent = label;
}

function initTheme() {
  try {
    const stored = localStorage.getItem("checklist-theme");
    if (stored === "dark" || stored === "light") {
      applyTheme(stored);
      return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  } catch (_) {
    applyTheme("light");
  }
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

initTheme();
render();

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

els.btnCopyBackup.addEventListener("click", () => {
  void copyBackupToClipboard();
});

els.btnPasteBackup.addEventListener("click", () => {
  els.pasteBackup.value = "";
  els.pasteError.textContent = "";
  els.modalPaste.showModal();
  els.pasteBackup.focus();
});

els.pasteCancel.addEventListener("click", () => els.modalPaste.close());

els.pasteSubmit.addEventListener("click", () => {
  els.pasteError.textContent = "";
  try {
    const items = decodeBackupText(els.pasteBackup.value);
    applyImportedItems(items);
    els.modalPaste.close();
  } catch (e) {
    els.pasteError.textContent = e instanceof Error ? e.message : String(e);
  }
});

els.btnDownloadFile.addEventListener("click", () => {
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
    applyImportedItems(incoming);
  } catch {
    alert("Could not read that file. Use a JSON export from this app or a CL1: backup code.");
  }
});
