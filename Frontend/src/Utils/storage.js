/**
 * Safely get user from localStorage
 * @returns {Object} User object or empty object
 */
export const getStoredUser = () => {
  try {
    const stored = localStorage.getItem("user");
    if (!stored || stored === "undefined" || stored === "null") {
      return {};
    }
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

/**
 * Safely get token from localStorage
 * @returns {string|null} Token or null
 */
export const getStoredToken = () => {
  const token = localStorage.getItem("token");
  if (!token || token === "undefined" || token === "null") {
    return null;
  }
  return token;
};

/**
 * Store user in localStorage
 * @param {Object} user - User object to store
 */
export const setStoredUser = (user) => {
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("user");
  }
};

/**
 * Clear all auth data from localStorage
 */
export const clearStorage = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
};

