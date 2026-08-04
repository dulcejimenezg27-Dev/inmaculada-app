/**
 * InmaLink — Firebase Auth (Google) + Firestore
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const cfg = window.INMALINK_FIREBASE_CONFIG || {};
const isConfigured = !!(cfg.apiKey && cfg.projectId);

let app = null;
let auth = null;
let db = null;

function sanitize(data) {
  return JSON.parse(JSON.stringify(data));
}

function withTimeout(promise, ms = 25000, label = "Operación") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} tardó demasiado.`)), ms);
    }),
  ]);
}

async function initFirebase() {
  if (!isConfigured) return;
  app = initializeApp(cfg);
  auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  db = getFirestore(app);
}

const initPromise = initFirebase()
  .then(() => window.dispatchEvent(new Event("inmalink-firebase-ready")))
  .catch((err) => {
    console.error("InmaLink Firebase:", err);
    window.dispatchEvent(new Event("inmalink-firebase-ready"));
  });

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

async function signInWithGoogle() {
  await initPromise;
  if (!auth) throw new Error("Firebase no configurado");
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code = String(err?.code || "");
    if (
      code.includes("popup-blocked") ||
      code.includes("popup-closed") ||
      code.includes("cancelled") ||
      /iPhone|iPad|Android/i.test(navigator.userAgent)
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

async function handleRedirectResult() {
  await initPromise;
  if (!auth) return null;
  try {
    return await getRedirectResult(auth);
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function logOut() {
  await initPromise;
  if (!auth) return;
  await signOut(auth);
}

function onAuth(callback) {
  initPromise.then(() => {
    if (!auth) {
      callback(null);
      return;
    }
    onAuthStateChanged(auth, callback);
  });
}

async function getPerfil(uid) {
  await initPromise;
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, "perfiles", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function savePerfil(uid, data) {
  await initPromise;
  if (!db || !uid) throw new Error("Sin usuario");
  const payload = sanitize({
    ...data,
    uid,
    updatedAt: new Date().toISOString(),
  });
  if (!payload.createdAt) payload.createdAt = new Date().toISOString();
  await setDoc(doc(db, "perfiles", uid), payload, { merge: true });
  return payload;
}

function watchPosts(callback, max = 80) {
  if (!db) {
    initPromise.then(() => {
      if (db) watchPosts(callback, max);
    });
    return () => {};
  }
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (err) => console.error(err)
  );
}

async function createPost(data) {
  await initPromise;
  if (!db || !auth?.currentUser) throw new Error("Debes iniciar sesión");
  const uid = auth.currentUser.uid;
  const ref = await addDoc(collection(db, "posts"), sanitize({
    ...data,
    autorUid: uid,
    likesCount: 0,
    likedBy: [],
    dislikesCount: 0,
    dislikedBy: [],
    comentariosCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  return ref.id;
}

async function toggleLike(postId) {
  await initPromise;
  if (!db || !auth?.currentUser) throw new Error("Debes iniciar sesión");
  const uid = auth.currentUser.uid;
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Publicación no encontrada");
  const data = snap.data();
  const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
  const dislikedBy = Array.isArray(data.dislikedBy) ? data.dislikedBy : [];
  const liked = likedBy.includes(uid);
  const disliked = dislikedBy.includes(uid);
  const patch = {
    likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
    likesCount: increment(liked ? -1 : 1),
    updatedAt: new Date().toISOString(),
  };
  // Me gusta y no me gusta son excluyentes
  if (!liked && disliked) {
    patch.dislikedBy = arrayRemove(uid);
    patch.dislikesCount = increment(-1);
  }
  await updateDoc(ref, patch);
  return !liked;
}

async function toggleDislike(postId) {
  await initPromise;
  if (!db || !auth?.currentUser) throw new Error("Debes iniciar sesión");
  const uid = auth.currentUser.uid;
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Publicación no encontrada");
  const data = snap.data();
  const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
  const dislikedBy = Array.isArray(data.dislikedBy) ? data.dislikedBy : [];
  const liked = likedBy.includes(uid);
  const disliked = dislikedBy.includes(uid);
  const patch = {
    dislikedBy: disliked ? arrayRemove(uid) : arrayUnion(uid),
    dislikesCount: increment(disliked ? -1 : 1),
    updatedAt: new Date().toISOString(),
  };
  if (!disliked && liked) {
    patch.likedBy = arrayRemove(uid);
    patch.likesCount = increment(-1);
  }
  await updateDoc(ref, patch);
  return !disliked;
}

async function addComentario(postId, texto, meta = {}) {
  await initPromise;
  if (!db || !auth?.currentUser) throw new Error("Debes iniciar sesión");
  const autorUid = meta.autorUid || auth.currentUser.uid;
  const ref = collection(db, "posts", postId, "comentarios");
  await addDoc(ref, sanitize({
    texto: String(texto || "").trim(),
    autorLabel: String(meta.autorLabel || "Usuario").trim(),
    autorUid,
    autorRol: String(meta.autorRol || "").trim(),
    autorGrado: String(meta.autorGrado || "").trim(),
    autorNombre: String(meta.autorNombre || "").trim(),
    autorApellidos: String(meta.autorApellidos || "").trim(),
    likesCount: 0,
    likedBy: [],
    dislikesCount: 0,
    dislikedBy: [],
    createdAt: new Date().toISOString(),
  }));
  await updateDoc(doc(db, "posts", postId), {
    comentariosCount: increment(1),
    updatedAt: new Date().toISOString(),
  });
}

async function toggleCommentLike(postId, commentId) {
  await initPromise;
  if (!db || !auth?.currentUser) throw new Error("Debes iniciar sesión");
  const uid = auth.currentUser.uid;
  const ref = doc(db, "posts", postId, "comentarios", commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Comentario no encontrado");
  const data = snap.data();
  const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
  const dislikedBy = Array.isArray(data.dislikedBy) ? data.dislikedBy : [];
  const liked = likedBy.includes(uid);
  const disliked = dislikedBy.includes(uid);
  const patch = {
    likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
    likesCount: increment(liked ? -1 : 1),
  };
  if (!liked && disliked) {
    patch.dislikedBy = arrayRemove(uid);
    patch.dislikesCount = increment(-1);
  }
  await updateDoc(ref, patch);
  return !liked;
}

async function toggleCommentDislike(postId, commentId) {
  await initPromise;
  if (!db || !auth?.currentUser) throw new Error("Debes iniciar sesión");
  const uid = auth.currentUser.uid;
  const ref = doc(db, "posts", postId, "comentarios", commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Comentario no encontrado");
  const data = snap.data();
  const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
  const dislikedBy = Array.isArray(data.dislikedBy) ? data.dislikedBy : [];
  const liked = likedBy.includes(uid);
  const disliked = dislikedBy.includes(uid);
  const patch = {
    dislikedBy: disliked ? arrayRemove(uid) : arrayUnion(uid),
    dislikesCount: increment(disliked ? -1 : 1),
  };
  if (!disliked && liked) {
    patch.likedBy = arrayRemove(uid);
    patch.likesCount = increment(-1);
  }
  await updateDoc(ref, patch);
  return !disliked;
}

function watchComentarios(postId, callback) {
  if (!db || !postId) return () => {};
  const q = query(
    collection(db, "posts", postId, "comentarios"),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error(err)
  );
}

async function deleteOwnPost(postId, uid) {
  await initPromise;
  if (!db || !uid) throw new Error("Sin permiso");
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().autorUid !== uid) {
    throw new Error("No puedes eliminar esta publicación");
  }
  const comments = await getDocs(collection(db, "posts", postId, "comentarios"));
  await Promise.all(comments.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(ref);
}

window.InmaLinkFirebase = {
  configured: isConfigured,
  ready: initPromise,
  get auth() {
    return auth;
  },
  get db() {
    return db;
  },
  signInWithGoogle,
  handleRedirectResult,
  logOut,
  onAuth,
  getPerfil,
  savePerfil,
  watchPosts,
  createPost,
  toggleLike,
  toggleDislike,
  addComentario,
  toggleCommentLike,
  toggleCommentDislike,
  watchComentarios,
  deleteOwnPost,
  serverTimestamp,
};
