import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { ToastContext, type ToastApi, type ToastOptions, type ToastType } from './toastContext';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}
const TOAST_ICONS: Record<ToastType, IconName> = {
  success: 'check',
  error: 'alert',
  info: 'info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = ++nextId.current;
      const type = options.type ?? 'info';
      setItems((current) => [...current, { id, message, type }]);

      const timeout = options.timeout ?? (type === 'error' ? 6000 : 3800);
      if (timeout > 0) window.setTimeout(() => remove(id), timeout);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (message, options) => push(message, { ...options, type: 'success' }),
      error: (message, options) =>
        push(message, {
          ...options,
          type: 'error',
          timeout: options?.timeout ?? 6000,
        }),
      info: (message, options) => push(message, { ...options, type: 'info' }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-root" id="toast-root">
        {items.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}`}
            onClick={() => remove(toast.id)}
            role="status"
          >
            <span className="toast__icon">
              <Icon name={TOAST_ICONS[toast.type]} size={18} />
            </span>
            <span className="toast__msg">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
