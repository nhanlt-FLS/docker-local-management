import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { DialogContext, type ConfirmOptions, type PromptOptions } from './dialogContext';
import { Icon } from './Icon';
import { Modal } from './Modal';

type DialogState =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void }
  | null;

/** Provides promise-based confirm/prompt dialogs to the component tree. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setDialog({ kind: 'confirm', options, resolve })),
    [],
  );
  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => setDialog({ kind: 'prompt', options, resolve })),
    [],
  );
  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  const close = (value: boolean | string | null) => {
    if (dialog?.kind === 'confirm') dialog.resolve(Boolean(value));
    if (dialog?.kind === 'prompt') {
      dialog.resolve(typeof value === 'string' ? value : null);
    }
    setDialog(null);
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog?.kind === 'confirm' && (
        <Modal
          title={dialog.options.title}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => close(false)}>
                Cancel
              </button>
              <button
                className={`btn ${dialog.options.danger === false ? 'btn--primary' : 'btn--danger'}`}
                autoFocus
                onClick={() => close(true)}
              >
                {dialog.options.confirmLabel || 'Confirm'}
              </button>
            </>
          }
        >
          <div className="gap" style={{ alignItems: 'flex-start', gap: 12 }}>
            <span
              style={{ color: dialog.options.danger === false ? 'var(--accent)' : 'var(--red)' }}
            >
              <Icon name={dialog.options.danger === false ? 'info' : 'alert'} size={22} />
            </span>
            <div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{dialog.options.message}</div>
              {dialog.options.details && (
                <div
                  className="mono"
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: 'var(--text-dim)',
                    wordBreak: 'break-all',
                  }}
                >
                  {dialog.options.details}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
      {dialog?.kind === 'prompt' && <PromptDialog options={dialog.options} onDone={close} />}
    </DialogContext.Provider>
  );
}

function PromptDialog({
  options,
  onDone,
}: {
  options: PromptOptions;
  onDone: (value: string | null) => void;
}) {
  const [value, setValue] = useState(options.value ?? '');

  return (
    <Modal
      title={options.title}
      onClose={() => onDone(null)}
      footer={
        <>
          <button className="btn btn--ghost" onClick={() => onDone(null)}>
            Cancel
          </button>
          <button className="btn btn--primary" autoFocus onClick={() => onDone(value)}>
            {options.confirmLabel || 'OK'}
          </button>
        </>
      }
    >
      <div className="field">
        {options.label && <label className="field__label">{options.label}</label>}
        {options.multiline ? (
          <textarea
            className="textarea"
            rows={4}
            placeholder={options.placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : (
          <input
            className="input"
            type="text"
            placeholder={options.placeholder}
            value={value}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onDone(value);
            }}
          />
        )}
      </div>
    </Modal>
  );
}
