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

function withTimeout(promise, ms = 20000, label = "Operación") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} tardó demasiado. Revisa tu conexión.`)), ms);
    }),
  ]);
}

/** Firestore rechaza `undefined`; limpia el objeto. */
function sanitize(data) {
  return JSON.parse(JSON.stringify(data));
}

async function initFirebase() {
  if (!isConfigured) return;
  app = initializeApp(cfg);
  auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  db = getFirestore(app);
}

const initPromise = initFirebase()
  .then(() => {
    window.dispatchEvent(new Event("inmaculada-firebase-ready"));
  })
  .catch((err) => {
    console.error("Firebase init:", err);
    window.dispatchEvent(new Event("inmaculada-firebase-ready"));
  });

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

async function isDocenteAuthorized(email) {
  if (!requireApproval) return true;
  if (!db || !email) return false;
  const id = emailDocId(email);
  try {
    const snap = await withTimeout(getDoc(doc(db, "docentes_autorizados", id)), 12000, "Autorización");
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
  await initPromise;
  if (!db) return [];
  const snap = await withTimeout(getDocs(collection(db, "comunicados")), 20000, "Carga de comunicados");
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
}

async function saveComunicado(item) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  if (!auth?.currentUser) throw new Error("Debes iniciar sesión para guardar en la nube");
  const { id, ...rest } = item;
  if (!id) throw new Error("Comunicado sin id");
  await withTimeout(
    setDoc(doc(db, "comunicados", id), sanitize({ ...rest, id }), { merge: true }),
    20000,
    "Guardar comunicado"
  );
}

async function removeComunicado(id) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  if (!auth?.currentUser) throw new Error("Debes iniciar sesión");
  await withTimeout(deleteDoc(doc(db, "comunicados", id)), 20000, "Eliminar comunicado");
}

async function fetchPuestosMap() {
  await initPromise;
  if (!db) return {};
  const snap = await withTimeout(getDocs(collection(db, "puestos")), 20000, "Carga de cuadro de honor");
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
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  if (!auth?.currentUser) throw new Error("Debes iniciar sesión para guardar en la nube");
  const id = puestosDocId(entry.salon, entry.periodo);
  await withTimeout(
    setDoc(doc(db, "puestos", id), sanitize({ ...entry }), { merge: true }),
    20000,
    "Guardar cuadro de honor"
  );
}

async function removePuestosEntry(salon, periodo) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  if (!auth?.currentUser) throw new Error("Debes iniciar sesión");
  await withTimeout(
    deleteDoc(doc(db, "puestos", puestosDocId(salon, periodo))),
    20000,
    "Eliminar cuadro de honor"
  );
}

function watchComunicados(callback) {
  if (!db) {
    initPromise.then(() => {
      if (db) watchComunicados(callback);
    });
    return () => {};
  }
  return onSnapshot(
    collection(db, "comunicados"),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
      callback(items);
    },
    (err) => console.error(err)
  );
}

function watchPuestos(callback) {
  if (!db) {
    initPromise.then(() => {
      if (db) watchPuestos(callback);
    });
    return () => {};
  }
  return onSnapshot(
    collection(db, "puestos"),
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const salon = data.salon || parsePuestosDocId(d.id).salon;
        const periodo = String(data.periodo || parsePuestosDocId(d.id).periodo);
        map[`${salon}|${periodo}`] = { ...data, salon, periodo };
      });
      callback(map);
    },
    (err) => console.error(err)
  );
}

window.InmaculadaFirebase = {
  ready: true,
  configured: isConfigured,
  requireApproval,
  get auth() {
    return auth;
  },
  get db() {
    return db;
  },
  whenReady: () => initPromise,
  isAdminEmail,
  isDocenteAuthorized,
  signIn: async (email, password) => {
    await initPromise;
    return signInWithEmailAndPassword(auth, email, password);
  },
  signOut: async () => {
    await initPromise;
    return signOut(auth);
  },
  onAuth: (cb) => {
    initPromise.then(() => {
      if (auth) onAuthStateChanged(auth, cb);
      else cb(null);
    });
  },
  fetchComunicados,
  saveComunicado,
  removeComunicado,
  fetchPuestosMap,
  savePuestosEntry,
  removePuestosEntry,
  watchComunicados,
  watchPuestos,
};

// El evento ready se dispara al terminar initPromise (arriba).
