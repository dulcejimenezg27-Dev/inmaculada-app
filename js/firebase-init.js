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

function isBienestarEmail(email) {
  const list = (window.BIENESTAR_CONFIG?.allowedEmails || []).map((e) =>
    String(e).trim().toLowerCase()
  );
  if (!list.length) return false;
  return list.includes(String(email || "").trim().toLowerCase());
}

function isPersoneroEmail(email) {
  const list = (window.PERSONERO_CONFIG?.allowedEmails || []).map((e) =>
    String(e).trim().toLowerCase()
  );
  if (!list.length) return false;
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

function perfilCompleto(perfil) {
  return !!(
    perfil &&
    String(perfil.nombres || "").trim() &&
    String(perfil.apellidos || "").trim()
  );
}

function cargoLabel(cargo) {
  const map = {
    coordinador: "Coordinador",
    rector: "Rector",
    secretaria: "Secretaria",
  };
  const key = String(cargo || "").trim().toLowerCase();
  return map[key] || String(cargo || "").trim();
}

function buildAutorFromPerfil(perfil, user) {
  const nombres = String(perfil?.nombres || "").trim();
  const apellidos = String(perfil?.apellidos || "").trim();
  const nombreCompleto = [nombres, apellidos].filter(Boolean).join(" ").trim();
  const cargo = String(perfil?.cargo || "").trim();
  const licenciatura = String(perfil?.licenciatura || "").trim();
  const rol = cargoLabel(cargo) || licenciatura;
  return {
    uid: perfil?.uid || user?.uid || "",
    email: perfil?.email || user?.email || "",
    nombres,
    apellidos,
    nombreCompleto: nombreCompleto || "Docente",
    cargo,
    cargoLabel: rol,
    licenciatura: rol,
    fotoUrl: String(perfil?.fotoUrl || "").trim(),
  };
}

const ADMIN_PERFIL_ID = "admin";

async function fetchPerfil(uid) {
  await initPromise;
  if (!db || !uid) return null;
  const snap = await withTimeout(getDoc(doc(db, "perfiles", uid)), 12000, "Carga de perfil");
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}

async function savePerfil(perfil) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  const user = auth?.currentUser;
  if (!user) throw new Error("Debes iniciar sesión para guardar tu perfil");
  const uid = user.uid;
  const payload = sanitize({
    uid,
    email: user.email || "",
    nombres: String(perfil.nombres || "").trim(),
    apellidos: String(perfil.apellidos || "").trim(),
    licenciatura: String(perfil.licenciatura || "").trim(),
    cargo: "",
    fotoUrl: String(perfil.fotoUrl || "").trim(),
    updatedAt: new Date().toISOString(),
  });
  if (!payload.nombres || !payload.apellidos) {
    throw new Error("Nombres y apellidos son obligatorios");
  }
  await withTimeout(
    setDoc(doc(db, "perfiles", uid), payload, { merge: true }),
    20000,
    "Guardar perfil"
  );
  return payload;
}

/** Perfil del panel Admin (documento fijo, sin Authentication). */
async function saveAdminPerfil(perfil) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  const cargo = String(perfil.cargo || "").trim().toLowerCase();
  if (!["coordinador", "rector", "secretaria"].includes(cargo)) {
    throw new Error("Selecciona el cargo: Coordinador, Rector o Secretaria");
  }
  const payload = sanitize({
    uid: ADMIN_PERFIL_ID,
    email: "",
    nombres: String(perfil.nombres || "").trim(),
    apellidos: String(perfil.apellidos || "").trim(),
    cargo,
    licenciatura: cargoLabel(cargo),
    fotoUrl: String(perfil.fotoUrl || "").trim(),
    updatedAt: new Date().toISOString(),
  });
  if (!payload.nombres || !payload.apellidos) {
    throw new Error("Nombres y apellidos son obligatorios");
  }
  await withTimeout(
    setDoc(doc(db, "perfiles", ADMIN_PERFIL_ID), payload, { merge: true }),
    20000,
    "Guardar perfil admin"
  );
  return payload;
}

async function fetchAdminPerfil() {
  return fetchPerfil(ADMIN_PERFIL_ID);
}

async function fetchPerfilesMap() {
  await initPromise;
  if (!db) return {};
  const snap = await withTimeout(getDocs(collection(db, "perfiles")), 20000, "Carga de perfiles");
  const map = {};
  snap.docs.forEach((d) => {
    map[d.id] = { uid: d.id, ...d.data() };
  });
  return map;
}

function watchPerfiles(callback) {
  if (!db) {
    initPromise.then(() => {
      if (db) watchPerfiles(callback);
    });
    return () => {};
  }
  return onSnapshot(
    collection(db, "perfiles"),
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = { uid: d.id, ...d.data() };
      });
      callback(map);
    },
    (err) => console.error(err)
  );
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
  await withTimeout(deleteDoc(doc(db, "comunicados", id)), 20000, "Eliminar comunicado");
}

async function fetchBienestar() {
  await initPromise;
  if (!db) return [];
  const snap = await withTimeout(getDocs(collection(db, "bienestar")), 20000, "Carga de bienestar");
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
}

async function saveBienestar(item) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  const { id, ...rest } = item;
  if (!id) throw new Error("Publicación sin id");
  await withTimeout(
    setDoc(doc(db, "bienestar", id), sanitize({ ...rest, id }), { merge: true }),
    20000,
    "Guardar bienestar"
  );
}

async function removeBienestar(id) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  await withTimeout(deleteDoc(doc(db, "bienestar", id)), 20000, "Eliminar bienestar");
}

async function fetchPersonero() {
  await initPromise;
  if (!db) return [];
  const snap = await withTimeout(getDocs(collection(db, "personero")), 20000, "Carga de personero");
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
}

async function savePersonero(item) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  const { id, ...rest } = item;
  if (!id) throw new Error("Publicación sin id");
  await withTimeout(
    setDoc(doc(db, "personero", id), sanitize({ ...rest, id }), { merge: true }),
    20000,
    "Guardar personero"
  );
}

async function removePersonero(id) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  await withTimeout(deleteDoc(doc(db, "personero", id)), 20000, "Eliminar personero");
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
  await withTimeout(
    deleteDoc(doc(db, "puestos", puestosDocId(salon, periodo))),
    20000,
    "Eliminar cuadro de honor"
  );
}

async function fetchEventos() {
  await initPromise;
  if (!db) return [];
  const snap = await withTimeout(getDocs(collection(db, "eventos")), 20000, "Carga de agenda");
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
}

async function saveEvento(item) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  const { id, ...rest } = item;
  if (!id) throw new Error("Evento sin id");
  await withTimeout(
    setDoc(doc(db, "eventos", id), sanitize({ ...rest, id }), { merge: true }),
    20000,
    "Guardar evento"
  );
}

async function removeEvento(id) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  await withTimeout(deleteDoc(doc(db, "eventos", id)), 20000, "Eliminar evento");
}

const LIKES_CLIENT_KEY = "inmaculada_like_client_id";

function getLikeClientId() {
  try {
    let id = localStorage.getItem(LIKES_CLIENT_KEY);
    if (id && /^[a-zA-Z0-9_-]{8,64}$/.test(id)) return id;
    id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(LIKES_CLIENT_KEY, id);
    return id;
  } catch {
    return `c${Date.now().toString(36)}tmp`;
  }
}

function likeDocId(comunicadoId, clientId) {
  return `${comunicadoId}__${clientId}`;
}

/**
 * @returns {{ counts: Record<string, number>, mine: Set<string> }}
 */
function aggregateLikes(docs, clientId) {
  const counts = {};
  const mine = new Set();
  docs.forEach((d) => {
    const data = d.data ? d.data() : d;
    const comId = data.comunicadoId || String(d.id || "").split("__")[0];
    if (!comId) return;
    counts[comId] = (counts[comId] || 0) + 1;
    if (data.clientId === clientId) mine.add(comId);
  });
  return { counts, mine };
}

async function fetchLikesState() {
  await initPromise;
  if (!db) return { counts: {}, mine: new Set() };
  const clientId = getLikeClientId();
  const snap = await withTimeout(getDocs(collection(db, "likes")), 20000, "Carga de me gusta");
  return aggregateLikes(snap.docs, clientId);
}

function watchLikes(callback) {
  if (!db) {
    initPromise.then(() => {
      if (db) watchLikes(callback);
    });
    return () => {};
  }
  const clientId = getLikeClientId();
  return onSnapshot(
    collection(db, "likes"),
    (snap) => {
      callback(aggregateLikes(snap.docs, clientId));
    },
    (err) => console.error(err)
  );
}

async function toggleLike(comunicadoId) {
  await initPromise;
  if (!db) throw new Error("Firebase no configurado");
  const comId = String(comunicadoId || "").trim();
  if (!comId) throw new Error("Comunicado inválido");
  const clientId = getLikeClientId();
  const id = likeDocId(comId, clientId);
  const ref = doc(db, "likes", id);
  const existing = await withTimeout(getDoc(ref), 12000, "Me gusta");
  if (existing.exists()) {
    await withTimeout(deleteDoc(ref), 12000, "Quitar me gusta");
    return false;
  }
  await withTimeout(
    setDoc(ref, sanitize({
      comunicadoId: comId,
      clientId,
      createdAt: new Date().toISOString(),
    })),
    12000,
    "Dar me gusta"
  );
  return true;
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

function watchBienestar(callback) {
  if (!db) {
    initPromise.then(() => {
      if (db) watchBienestar(callback);
    });
    return () => {};
  }
  return onSnapshot(
    collection(db, "bienestar"),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
      callback(items);
    },
    (err) => console.error(err)
  );
}

function watchPersonero(callback) {
  if (!db) {
    initPromise.then(() => {
      if (db) watchPersonero(callback);
    });
    return () => {};
  }
  return onSnapshot(
    collection(db, "personero"),
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

function watchEventos(callback) {
  if (!db) {
    initPromise.then(() => {
      if (db) watchEventos(callback);
    });
    return () => {};
  }
  return onSnapshot(
    collection(db, "eventos"),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
      callback(items);
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
  isBienestarEmail,
  isPersoneroEmail,
  isDocenteAuthorized,
  perfilCompleto,
  cargoLabel,
  buildAutorFromPerfil,
  fetchPerfil,
  savePerfil,
  fetchAdminPerfil,
  saveAdminPerfil,
  ADMIN_PERFIL_ID,
  fetchPerfilesMap,
  watchPerfiles,
  signIn: async (email, password) => {
    await initPromise;
    return signInWithEmailAndPassword(auth, email, password);
  },
  signOut: async () => {
    await initPromise;
    if (!auth?.currentUser) return;
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
  fetchBienestar,
  saveBienestar,
  removeBienestar,
  fetchPersonero,
  savePersonero,
  removePersonero,
  fetchPuestosMap,
  savePuestosEntry,
  removePuestosEntry,
  fetchEventos,
  saveEvento,
  removeEvento,
  watchComunicados,
  watchBienestar,
  watchPersonero,
  watchPuestos,
  watchEventos,
  getLikeClientId,
  fetchLikesState,
  watchLikes,
  toggleLike,
};

// El evento ready se dispara al terminar initPromise (arriba).
