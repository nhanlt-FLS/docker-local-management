import type { ReactNode } from 'react';
import { DialogProvider } from '@/components/ui/DialogProvider';
import { ToastProvider } from '@/components/ui/ToastProvider';

/** Application-wide context providers are composed in one place. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DialogProvider>{children}</DialogProvider>
    </ToastProvider>
  );
}
