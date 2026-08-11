import { useState, type JSX } from "react";

import { RowActionMenu } from "../../../shared/components/row-action-menu";

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
    <RowActionMenu label={label} open={open} onOpenChange={setOpen}>
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
    </RowActionMenu>
  );
}
