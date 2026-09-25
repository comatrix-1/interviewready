export const USERNAME_STORAGE_KEY = "interviewready_username";

export const getCurrentUsername = (): string => localStorage.getItem(USERNAME_STORAGE_KEY) || "";

export const setCurrentUsername = (username: string): void => {
  localStorage.setItem(USERNAME_STORAGE_KEY, username);
};

export const clearCurrentUsername = (): void => {
  localStorage.removeItem(USERNAME_STORAGE_KEY);
};

/**
 * Identity headers attached to user-owned API calls. Empty when nobody has
 * logged in, in which case the backend falls back to the dev-user identity.
 */
export const getUserHeaders = (): Record<string, string> => {
  const username = getCurrentUsername();
  return username ? { "X-User-Id": username } : {};
};
