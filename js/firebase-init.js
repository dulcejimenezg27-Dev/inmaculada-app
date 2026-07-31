/**
 * Inicialización Firebase Auth + Firestore
 * Expone window.InmaculadaFirebase cuando esté listo.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const cfg = window.FIREBASE_CONFIG || {};
const isConfigured =
  cfg.apiKey &&
  cfg.apiKey !== "TU_API_KEY" &&
  cfg.projectId &&
  cfg.projectId !== "TU_PROYECTO";

const requireApproval = window.ADMIN_CONFIG?.requireDocenteApproval === true;

let app = null;
let auth = null;
let db = null;

if (isConfigured) {
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

function isAdminEmail(email) {
  const list = (window.ADMIN_CONFIG?.adminEmails || []).map((e) =>
    String(e).trim().toLowerCase()
  );
  return list.includes(String(email || "").trim().toLowerCase());
}

function emailDocId(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/\//g, "_");
}

/** Autorización opcional en Firestore: docentes_autorizados/{email} */
async function isDocenteAuthorized(email) {
  if (!requireApproval) return true;
  if (!db || !email) return false;
  const id = emailDocId(email);
  try {
    const snap = await getDoc(doc(db, "docentes_autorizados", id));
    return snap.exists();
  } catch (err) {
    console.error(err);
    return false;
  }
}

function puestosDocId(salon, periodo) {
  return `${String(salon).replace(/\|/g, "_")}__${periodo}`;
}

function parsePuestosDocId(id) {
  const parts = String(id).split("__");
  if (parts.length < 2) return { salon: id, periodo: "1" };
  return { salon: parts[0], periodo: parts[parts.length - 1] };
}

async function fetchComunicados() {
  if (!db) return [];
  const snap = await getDocs(collection(db, "comunicados"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
}

async function saveComunicado(item) {
  if (!db) throw new Error("Firebase no configurado");
  const { id, ...rest } = item;
  await setDoc(doc(db, "comunicados", id), { ...rest, id }, { merge: true });
}

async function removeComunicado(id) {
  if (!db) throw new Error("Firebase no configurado");
  await deleteDoc(doc(db, "comunicados", id));
}

async function fetchPuestosMap() {
  if (!db) return {};
  const snap = await getDocs(collection(db, "puestos"));
  const map = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    const salon = data.salon || parsePuestosDocId(d.id).salon;
    const periodo = String(data.periodo || parsePuestosDocId(d.id).periodo);
    map[`${salon}|${periodo}`] = { ...data, salon, periodo };
  });
  return map;
}

async function savePuestosEntry(entry) {
  if (!db) throw new Error("Firebase no configurado");
  const id = puestosDocId(entry.salon, entry.periodo);
  await setDoc(doc(db, "puestos", id), { ...entry }, { merge: true });
}

async function removePuestosEntry(salon, periodo) {
  if (!db) throw new Error("Firebase no configurado");
  await deleteDoc(doc(db, "puestos", puestosDocId(salon, periodo)));
}

function watchComunicados(callback) {
  if (!db) return () => {};
  return onSnapshot(collection(db, "comunicados"), (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
    callback(items);
  });
}

function watchPuestos(callback) {
  if (!db) return () => {};
  return onSnapshot(collection(db, "puestos"), (snap) => {
    const map = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const salon = data.salon || parsePuestosDocId(d.id).salon;
      const periodo = String(data.periodo || parsePuestosDocId(d.id).periodo);
      map[`${salon}|${periodo}`] = { ...data, salon, periodo };
    });
    callback(map);
  });
}

window.InmaculadaFirebase = {
  ready: true,
  configured: isConfigured,
  requireApproval,
  auth,
  db,
  isAdminEmail,
  isDocenteAuthorized,
  signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
  signOut: () => signOut(auth),
  onAuth: (cb) => (auth ? onAuthStateChanged(auth, cb) : cb(null)),
  fetchComunicados,
  saveComunicado,
  removeComunicado,
  fetchPuestosMap,
  savePuestosEntry,
  removePuestosEntry,
  watchComunicados,
  watchPuestos,
};

window.dispatchEvent(new Event("inmaculada-firebase-ready"));
