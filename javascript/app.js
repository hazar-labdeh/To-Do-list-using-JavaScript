// ----------------------------------------  Firebase helpers ---------------------------------------------------------------------------------------------
import {
  fetchTasks,
  createTask,
  setTaskCompleted,
  setTaskText,
  removeTask,
  removeAllDone,
  removeAllTasks
} from "./firebase.js";


// -------------------------------------- text validation section ----------------------------------------------------------------------------
const validateTaskText = (text) => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "Task cannot be empty.";
  if (trimmed.length < 5) return "Task must be at least 5 characters.";
  if (!isNaN(trimmed[0])) return "Task must not start with a number.";
  return "";
};


// --------------------------------------------------------------------get modal elements ----------------------------------------------------------------------------------
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const modalInputWrap = document.getElementById("modalInputWrap");
const modalInput = document.getElementById("modalInput");
const modalError = document.getElementById("modalError");
const modalCancel = document.getElementById("modalCancel");
const modalConfirm = document.getElementById("modalConfirm");

let modalState = { onConfirm: null, mode: "confirm" };


// --------------------------------------------------- opening the modal  ----------------------------------------------------------------------------------------------
const openModal = ({ title, text, mode, confirmText, defaultValue, onConfirm }) => {
  modalTitle.textContent = title;
  modalText.textContent = text;
  modalConfirm.textContent = confirmText || "Confirm";
  modalError.textContent = "";

  modalState = { onConfirm, mode };

  if (mode === "prompt") {
    modalInputWrap.classList.remove("hidden");
    modalInput.value = defaultValue || "";
    setTimeout(() => modalInput.focus(), 0);
  } else {
    modalInputWrap.classList.add("hidden");
  }

  modalOverlay.classList.remove("hidden");
  modalOverlay.setAttribute("aria-hidden", "false");
};


// ---------------------------------------------- closing the modal  ---------------------------------------------------
const closeModal = () => {
  modalOverlay.classList.add("hidden");
  modalOverlay.setAttribute("aria-hidden", "true");
  modalState = { onConfirm: null, mode: "confirm" };
};


// ---------------------------------------------confirm/cancel section -------------------------------------------------------
modalCancel.addEventListener("click", () => closeModal());

modalConfirm.addEventListener("click", async () => {
  if (!modalState.onConfirm) return;

  if (modalState.mode === "prompt") {
    const nextValue = modalInput.value;
    const error = validateTaskText(nextValue);
    if (error) {
      modalError.textContent = error;
      return;
    }
    await modalState.onConfirm(nextValue.trim());
    closeModal();
    return;
  }

  await modalState.onConfirm();
  closeModal();
});



const taskInput = document.getElementById("taskInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const inputError = document.getElementById("inputError");
const taskList = document.getElementById("taskList");
const listMessage = document.getElementById("listMessage");
const deleteDoneBtn = document.getElementById("deleteDoneBtn");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const tabButtons = Array.from(document.querySelectorAll(".tabBtn"));


// ------------------------------------------------- store tasks + filter + loading state---------------------------------------------------------------
let tasks = [];
let activeFilter = "all";
let isBusy = false;


// ------------------------------------------------------- Firebase loading/busy -------------------------------------------------------------
const setBusy = (busy) => {
  isBusy = busy;
  addTaskBtn.disabled = busy;
  deleteDoneBtn.disabled = busy || !tasks.some((t) => t.completed);
  deleteAllBtn.disabled = busy || tasks.length === 0;
};


// ---------------------------------------------------error section --------------------------------------------------------------------
const showInputError = (msg) => {
  inputError.textContent = msg || "";
};


//-------------------------------------- filter section: All / Done / Todo-------------------------------------------------------------
const getFilteredTasks = () => {
  if (activeFilter === "done") return tasks.filter((t) => t.completed);
  if (activeFilter === "todo") return tasks.filter((t) => !t.completed);
  return tasks;
};


//-------------------------------------------------- Highlighting the active tab button------------------------------------------------------------------
const setTabsState = () => {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === activeFilter);
  });
};


// ----------------------------------------- render/display section -----------------------------------------------
const renderTasks = () => {
  taskList.innerHTML = "";
  setTabsState();

  const filtered = getFilteredTasks();

  if (tasks.length === 0) {
    listMessage.textContent = "No tasks yet. Add a new task above.";
  } else if (filtered.length === 0) {
    listMessage.textContent = "No tasks in this filter.";
  } else {
    listMessage.textContent = "";
  }

  filtered.forEach((task) => {
    const li = document.createElement("li");
    li.className = "taskItem";

    const left = document.createElement("div");
    left.className = "taskLeft";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!task.completed;
    checkbox.disabled = isBusy;
    checkbox.addEventListener("change", async () => {
      await toggleTask(task.id);
    });

    const text = document.createElement("span");
    text.className = `taskText ${task.completed ? "done" : ""}`;
    text.textContent = task.text;

    left.appendChild(checkbox);
    left.appendChild(text);

    const right = document.createElement("div");

    const editBtn = document.createElement("button");
    editBtn.className = "iconBtn";
    editBtn.title = "Rename";
    editBtn.innerHTML = `<span class="icon">✏️</span>`;
    editBtn.disabled = isBusy;
    editBtn.addEventListener("click", () => renameTask(task.id));

    const delBtn = document.createElement("button");
    delBtn.className = "iconBtn";
    delBtn.title = "Delete";
    delBtn.innerHTML = `<span class="icon">🗑️</span>`;
    delBtn.disabled = isBusy;
    delBtn.addEventListener("click", () => confirmDeleteTask(task.id));

    right.appendChild(editBtn);
    right.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(right);

    taskList.appendChild(li);
  });

  deleteDoneBtn.disabled = isBusy || !tasks.some((t) => t.completed);
  deleteAllBtn.disabled = isBusy || tasks.length === 0;
};


// ---------------------------------Loading tasks from Firebase on startup (this is the “sync from Firebase” section) -----------------------------------------
const syncFromFirebase = async () => {
  setBusy(true);
  try {
    listMessage.textContent = "Loading tasks from Firebase...";
    tasks = await fetchTasks();
    listMessage.textContent = "";
  } catch {
    listMessage.textContent = "Could not load tasks from Firebase. Check your config / Firestore rules.";
  } finally {
    setBusy(false);
    renderTasks();
  }
};


// -------------------------------------------- Adding a new task ---------------------------------------------------------------
const addTask = async () => {
  const raw = taskInput.value;
  const error = validateTaskText(raw);
  if (error) {
    showInputError(error);
    return;
  }

  setBusy(true);
  try {
    const task = {
      text: raw.trim(),
      completed: false,
      createdAt: Date.now()
    };

    const created = await createTask(task);
    tasks = [created, ...tasks];
    taskInput.value = "";
    showInputError("");
  } catch {
    showInputError("Failed to add task. Check Firebase connection.");
  } finally {
    setBusy(false);
    renderTasks();
  }
};


//------------------------------------------------------ checkbox/done section----------------------------------------------------
const toggleTask = async (taskId) => {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  setBusy(true);
  try {
    const next = !task.completed;
    await setTaskCompleted(taskId, next);
    tasks = tasks.map((t) => (t.id === taskId ? { ...t, completed: next } : t));
  } finally {
    setBusy(false);
    renderTasks();
  }
};


// ------------------------------------- Renaming a task  --------------------------------------------------
const renameTask = (taskId) => {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  openModal({
    title: "Rename task",
    text: "Enter the new task name.",
    mode: "prompt",
    confirmText: "Save",
    defaultValue: task.text,
    onConfirm: async (nextText) => {
      setBusy(true);
      try {
        await setTaskText(taskId, nextText);
        tasks = tasks.map((t) => (t.id === taskId ? { ...t, text: nextText } : t));
      } finally {
        setBusy(false);
        renderTasks();
      }
    }
  });
};


// ---------------------------------------------------------------- Deleting one task  ------------------------------------
const confirmDeleteTask = (taskId) => {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  openModal({
    title: "Delete task",
    text: `Are you sure you want to delete: "${task.text}" ?`,
    mode: "confirm",
    confirmText: "Delete",
    onConfirm: async () => {
      setBusy(true);
      try {
        await removeTask(taskId);
        tasks = tasks.filter((t) => t.id !== taskId);
      } finally {
        setBusy(false);
        renderTasks();
      }
    }
  });
};


// ---------------------------------------------- Deleting done tasks  -----------------------------------------------------
const deleteDoneTasksHandler = () => {
  if (!tasks.some((t) => t.completed)) {
    listMessage.textContent = "No done tasks to delete.";
    return;
  }

  openModal({
    title: "Delete done tasks",
    text: "Are you sure you want to delete all completed tasks?",
    mode: "confirm",
    confirmText: "Delete",
    onConfirm: async () => {
      setBusy(true);
      try {
        await removeAllDone();
        tasks = tasks.filter((t) => !t.completed);
      } finally {
        setBusy(false);
        renderTasks();
      }
    }
  });
};


// -----------------------------------------------Deleting ALL tasks  ----------------------------------------------------------
const deleteAllTasksHandler = () => {
  if (tasks.length === 0) {
    listMessage.textContent = "No tasks to delete.";
    return;
  }

  openModal({
    title: "Delete all tasks",
    text: "This will remove ALL tasks. Continue?",
    mode: "confirm",
    confirmText: "Delete All",
    onConfirm: async () => {
      setBusy(true);
      try {
        await removeAllTasks();
        tasks = [];
      } finally {
        setBusy(false);
        renderTasks();
      }
    }
  });
};


// ----------------------------------------------------  event listeners section ------------------------------------------------------------
addTaskBtn.addEventListener("click", async () => {
  await addTask();
});

taskInput.addEventListener("input", () => {
  const error = validateTaskText(taskInput.value);
  showInputError(error);
});

taskInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") await addTask();
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    renderTasks();
  });
});

deleteDoneBtn.addEventListener("click", () => {
  deleteDoneTasksHandler();
});

deleteAllBtn.addEventListener("click", () => {
  deleteAllTasksHandler();
});



await syncFromFirebase();
