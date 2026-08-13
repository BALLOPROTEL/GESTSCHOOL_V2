import { useState, type JSX } from "react";

import { RowActionMenu } from "../../../shared/components/row-action-menu";
import { useI18n } from "../../../shared/i18n-context";

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
  const { t } = useI18n();

  return (
    <RowActionMenu label={t(label)} open={open} onOpenChange={setOpen}>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {t(deleteLabel)}
          </button>
    </RowActionMenu>
  );
}
