// lib/nickname.js
export const NICKNAME_KEY = "escapeplan:nickname";

export function getNickname() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NICKNAME_KEY) || "";
}

export function setNickname(nick) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NICKNAME_KEY, nick.trim());
}

export function clearNickname() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NICKNAME_KEY);
}