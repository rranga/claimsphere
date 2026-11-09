import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { TextField } from '@/shared/ui/Field';

interface NameDialogProps {
  title: string;
  description: string;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/** Reused for "Split document" and "Rename document". */
export function DocumentNameDialog({
  title,
  description,
  initialName,
  submitLabel,
  onSubmit,
  onClose,
}: NameDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Please enter a document name');
    if (trimmed.length > 120) return setError('Keep the name under 120 characters');
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description}
      size="sm"
    >
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <TextField
          label="Document name"
          value={name}
          error={error}
          onChange={(e) => {
            setError(undefined);
            setName(e.target.value);
          }}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
