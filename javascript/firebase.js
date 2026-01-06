import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEpRlk1sHMBRwTfUgxorpjeQjE8ck850Y",
  authDomain: "task-5231a.firebaseapp.com",
  projectId: "task-5231a",
  storageBucket: "task-5231a.firebasestorage.app",
  messagingSenderId: "696535739520",
  appId: "1:696535739520:web:90d9b1fe829f878214ca65",
  measurementId: "G-4SJ377ENZV"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const tasksCol = collection(db, "tasks");


export const fetchTasks = async () => {
  const snap = await getDocs(tasksCol);
  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return tasks;
};

export const createTask = async (task) => {
  const ref = await addDoc(tasksCol, task);
  return { id: ref.id, ...task };
};

export const setTaskCompleted = async (taskId, completed) => {
  await updateDoc(doc(db, "tasks", taskId), { completed });
};

export const setTaskText = async (taskId, text) => {
  await updateDoc(doc(db, "tasks", taskId), { text });
};

export const removeTask = async (taskId) => {
  await deleteDoc(doc(db, "tasks", taskId));
};

export const removeAllDone = async () => {
  const snap = await getDocs(tasksCol);
  const batch = writeBatch(db);

  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.completed) batch.delete(d.ref);
  });

  await batch.commit();
};

export const removeAllTasks = async () => {
  const snap = await getDocs(tasksCol);
  const batch = writeBatch(db);

  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};
