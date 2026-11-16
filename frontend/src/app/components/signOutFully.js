"use client";

// Sign out completely, then load the home page fresh:
//   - waits until Clerk has really ended the session (all sessions of this browser)
//   - clears what this website keeps in the browser: verification-code passes
//     (sessionStorage) and the remembered choices (kpt-… in localStorage)
//   - a full page load to "/", so no page of the old login stays in memory
// (before, the page moved on before the session had ended and the old login
// could come back when a new address was typed.)
//
//   const { signOut } = useClerk();   <button onClick={() => signOutFully(signOut)}>

export async function signOutFully(signOut) {
  try {
    sessionStorage.clear();
  } catch {
    // nothing stored / not allowed
  }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("kpt-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // nothing stored / not allowed
  }
  try {
    await signOut();
  } catch {
    // signed out already, or the network failed – the page load below still leaves
  }
  window.location.replace("/");
}
