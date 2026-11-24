// The admin password, kept for this browser tab only (closing the tab logs out).
const KEY = 'adm-pass';

export function readPass() {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function writePass(pass) {
  try {
    if (pass) sessionStorage.setItem(KEY, pass);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

export const authHeaders = () => {
  const pass = readPass();
  return pass ? { Authorization: `Bearer ${pass}` } : {};
};
