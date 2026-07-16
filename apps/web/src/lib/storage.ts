import { Preferences } from "@capacitor/preferences";

const TOKEN_KEY = "splitly_token";

export async function getStoredToken(): Promise<string> {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value ?? "";
}

export async function setStoredToken(token: string): Promise<void> {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function clearStoredToken(): Promise<void> {
  await Preferences.remove({ key: TOKEN_KEY });
}
