/**
 * Shared Admin Authentication Guard
 * ---------------------------------------------------------------------
 * Every admin panel on this site used to be "protected" only by a
 * client-side prompt() password check (or nothing at all). That never
 * actually protected the data — anyone could open DevTools, read the
 * password out of the page source, or simply call the Firestore SDK
 * functions directly from the console, completely bypassing the prompt.
 *
 * Real protection now comes from Firebase Authentication + Firestore
 * Security Rules (see firestore.rules): every write to an admin-managed
 * collection requires a signed-in user whose email is in the admin
 * allow-list defined in firestore.rules. This module just gives the
 * legitimate admin a normal login screen so they can sign in and get a
 * valid Firebase Auth session (without this, their own writes would
 * also be rejected by the security rules).
 *
 * IMPORTANT — one-time setup required (cannot be done from code):
 *   1. Firebase Console -> Authentication -> Sign-in method -> enable
 *      "Email/Password".
 *   2. Firebase Console -> Authentication -> Users -> Add user, using
 *      one of the emails listed in ADMIN_EMAILS below.
 *   3. Keep ADMIN_EMAILS here IN SYNC with the isAdmin() allow-list in
 *      firestore.rules and storage.rules — they must match exactly.
 */

import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Keep this list identical to the allow-list in firestore.rules / storage.rules.
export const ADMIN_EMAILS = [
  "admin@marudharaexam.in"
];

function injectStyles() {
  if (document.getElementById("admin-auth-styles")) return;
  const style = document.createElement("style");
  style.id = "admin-auth-styles";
  style.textContent = `
    #adminAuthOverlay{position:fixed;inset:0;background:#0b1b33;display:flex;
      align-items:center;justify-content:center;z-index:999999;font-family:Arial,sans-serif;}
    #adminAuthOverlay .box{background:#fff;padding:32px;border-radius:14px;width:320px;
      max-width:90vw;box-shadow:0 10px 30px rgba(0,0,0,.35);}
    #adminAuthOverlay h2{margin:0 0 18px;color:#002B5B;text-align:center;font-size:20px;}
    #adminAuthOverlay input{width:100%;padding:12px;margin-bottom:12px;border:1px solid #ccc;
      border-radius:8px;box-sizing:border-box;font-size:15px;}
    #adminAuthOverlay button{width:100%;padding:12px;background:#FF8C00;color:#fff;border:0;
      border-radius:8px;font-size:16px;cursor:pointer;}
    #adminAuthOverlay button:disabled{opacity:.6;cursor:not-allowed;}
    #adminAuthOverlay .err{color:#c0392b;font-size:13px;margin-bottom:10px;min-height:16px;text-align:center;}
    #adminLogoutBtn{position:fixed;top:12px;right:12px;z-index:999998;padding:8px 14px;
      background:#002B5B;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:13px;}
    body.admin-auth-pending > *:not(#adminAuthOverlay){visibility:hidden;}
  `;
  document.head.appendChild(style);
}

function showLogoutButton(auth) {
  if (document.getElementById("adminLogoutBtn")) return;
  const btn = document.createElement("button");
  btn.id = "adminLogoutBtn";
  btn.textContent = "Logout";
  btn.onclick = () => signOut(auth);
  document.body.appendChild(btn);
}

function showLoginOverlay(auth) {
  injectStyles();
  document.body.classList.add("admin-auth-pending");
  let overlay = document.getElementById("adminAuthOverlay");
  if (overlay) { overlay.style.display = "flex"; return; }

  overlay = document.createElement("div");
  overlay.id = "adminAuthOverlay";
  overlay.innerHTML = `
    <div class="box">
      <h2>🔒 Admin Login</h2>
      <div class="err" id="adminAuthErr"></div>
      <input type="email" id="adminAuthEmail" placeholder="Admin Email" autocomplete="username">
      <input type="password" id="adminAuthPass" placeholder="Password" autocomplete="current-password">
      <button id="adminAuthSubmit">Login</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const submit = async () => {
    const email = document.getElementById("adminAuthEmail").value.trim();
    const pass = document.getElementById("adminAuthPass").value;
    const errEl = document.getElementById("adminAuthErr");
    const btn = document.getElementById("adminAuthSubmit");
    errEl.textContent = "";
    if (!email || !pass) { errEl.textContent = "Email aur password dono bharen."; return; }
    btn.disabled = true;
    btn.textContent = "Signing in...";
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged handler will remove the overlay.
    } catch (e) {
      errEl.textContent = "Login failed: galat email ya password.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Login";
    }
  };

  document.getElementById("adminAuthSubmit").addEventListener("click", submit);
  overlay.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
}

function hideLoginOverlay() {
  const overlay = document.getElementById("adminAuthOverlay");
  if (overlay) overlay.style.display = "none";
  document.body.classList.remove("admin-auth-pending");
}

/**
 * Blocks page usage until a signed-in Firebase Auth user whose email is
 * present in ADMIN_EMAILS is available, then resolves with that user.
 * Actual data protection is enforced by Firestore/Storage rules — this
 * only gives the admin a way to sign in and get a valid session.
 */
export function guardAdmin(app) {
  const auth = getAuth(app);
  injectStyles();
  document.body.classList.add("admin-auth-pending");

  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user && ADMIN_EMAILS.includes((user.email || "").toLowerCase())) {
        hideLoginOverlay();
        showLogoutButton(auth);
        resolve(user);
      } else {
        if (user) {
          // Signed in but not an allowed admin email — sign back out.
          signOut(auth);
        }
        showLoginOverlay(auth);
      }
    });
  });
}
