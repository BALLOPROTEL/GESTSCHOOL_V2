import { useState, type JSX } from "react";

type ReferenceActionMenuProps = {
  deleteLabel?: string;
  label: string;
  onDelete: () => void;
};

export function ReferenceActionMenu({
  deleteLabel = "Supprimer",
  label,
  onDelete
}: ReferenceActionMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="v3-action-cell">
      <button
        type="button"
        className="v3-more-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">...</span>
      </button>
      {open ? (
        <div className="v3-action-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {deleteLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
