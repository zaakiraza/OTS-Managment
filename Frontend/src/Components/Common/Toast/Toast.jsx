import { useState, useEffect, createContext, useContext, useCallback } from "react";
import "./Toast.css";

// Toast Context
const ToastContext = createContext(null);

// Toast Types
const TOAST_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
};

// Individual Toast Component
const ToastItem = ({ id, type, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4000);

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: "fas fa-check-circle",
    error: "fas fa-times-circle",
    warning: "fas fa-exclamation-triangle",
    info: "fas fa-info-circle",
  };

  return (
    <div className={`toast-item toast-${type}`}>
      <div className="toast-icon">
        <i className={icons[type]}></i>
      </div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={() => onClose(id)}>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

// Toast Container Component
export const ToastContainer = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = {
    success: (message) => addToast(TOAST_TYPES.SUCCESS, message),
    error: (message) => addToast(TOAST_TYPES.ERROR, message),
    warning: (message) => addToast(TOAST_TYPES.WARNING, message),
    info: (message) => addToast(TOAST_TYPES.INFO, message),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            id={t.id}
            type={t.type}
            message={t.message}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Hook to use toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastContainer");
  }
  return context;
};

export default ToastContainer;

