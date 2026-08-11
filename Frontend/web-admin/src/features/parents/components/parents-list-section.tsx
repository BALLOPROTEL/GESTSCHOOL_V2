import { useState } from "react";

import type { ParentRecord } from "../../../shared/types/app";
import { SCHOOL_NAME, roleLabel, statusLabel, statusPillClassName } from "../parents-screen-model";
import { useI18n } from "../../../shared/i18n-context";
import { ResponsiveDataTable } from "../../../shared/components/responsive-data-table";
import { RowActionMenu } from "../../../shared/components/row-action-menu";


const getParentInitials = (parent: ParentRecord): string => {
  const parts = parent.fullName.trim().split(/\s+/u).filter(Boolean);
  return `${parts[0]?.charAt(0) || ""}${parts[1]?.charAt(0) || parts[0]?.charAt(1) || ""}`.toUpperCase() || "RP";
};

export function ParentsListSection(props: {
  loading: boolean;
  onArchiveParent: (parentId: string) => void;
  onEditParent: (parent: ParentRecord) => void;
  onSearchChange: (value: string) => void;
  onSelectParent: (parentId: string) => void;
  search: string;
  selectedParent?: ParentRecord;
  shownParents: ParentRecord[];
}): JSX.Element {
  const { t: tr } = useI18n();
  const {
    loading,
    onArchiveParent,
    onEditParent,
    onSearchChange,
    onSelectParent,
    search,
    selectedParent,
    shownParents
  } = props;
  const [openParentActionMenuId, setOpenParentActionMenuId] = useState<string | null>(null);

  return (
    <>
      <section className="panel table-panel workflow-section module-modern parents-v3-table-card">
        <div className="v3-table-head">
          <div>
            <p className="section-kicker">{tr("Responsables")}</p>
            <h2>{tr("Liste des responsables")}</h2>
            <p>{tr("Contacts parentaux, comptes portail et rattachements élèves.")}</p>
          </div>
          <div className="students-table-toolbar">
            <label className="students-search-field">
              <span>{tr("Recherche rapide")}</span>
              <input
                className="search-input"
                placeholder={tr("Nom, téléphone, email")}
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
          </div>
        </div>
        <p className="section-lead">
          {tr("Un responsable est une personne rattachée à un ou plusieurs élèves. Le compte portail reste optionnel.")}</p>
        <ResponsiveDataTable label={tr("Liste des responsables")}>
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Responsable")}</th>
                <th>{tr("Rôle")}</th>
                <th>{tr("Téléphone")}</th>
                <th>{tr("Email")}</th>
                <th>{tr("Élèves liés")}</th>
                <th>{tr("Portail")}</th>
                <th>{tr("Statut")}</th>
                <th aria-label={tr("Actions")}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="empty-row">{tr("Chargement...")}</td></tr>
              ) : shownParents.length === 0 ? (
                <tr><td colSpan={8} className="empty-row">{tr("Aucun responsable enregistré.")}</td></tr>
              ) : (
                shownParents.map((parent) => (
                  <tr key={parent.id}>
                    <td data-label={tr("Responsable")}>
                      <div className="v3-table-entity-cell">
                        <span className="v3-avatar">{getParentInitials(parent)}</span>
                        <div>
                          <strong>{parent.fullName}</strong>
                          <small>{parent.profession || tr("Profession non renseignée")}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label={tr("Rôle")}>{tr(roleLabel(parent.parentalRole))}</td>
                    <td data-label={tr("Téléphone")}>{parent.primaryPhone}</td>
                    <td data-label={tr("Email")}>{parent.email || "-"}</td>
                    <td data-label={tr("Élèves liés")}>{parent.childrenCount}</td>
                    <td data-label={tr("Portail")}>{parent.userUsername ? tr("Lié") : tr("Non lié")}</td>
                    <td data-label={tr("Statut")}>
                      <span className={statusPillClassName(parent.status)}>{tr(statusLabel(parent.status))}</span>
                    </td>
                    <td data-label={tr("Actions")}>
                      <RowActionMenu
                        label={`${tr("Actions")} ${parent.fullName}`}
                        open={openParentActionMenuId === parent.id}
                        onOpenChange={(open) => setOpenParentActionMenuId(open ? parent.id : null)}
                      >
                            <button type="button" onClick={() => { setOpenParentActionMenuId(null); onSelectParent(parent.id); }}>{tr("Voir")}</button>
                            <button type="button" onClick={() => { setOpenParentActionMenuId(null); onEditParent(parent); }}>{tr("Modifier")}</button>
                            <button type="button" className="is-danger" onClick={() => { setOpenParentActionMenuId(null); onArchiveParent(parent.id); }}>{tr("Archiver")}</button>
                      </RowActionMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ResponsiveDataTable>
      </section>

      {selectedParent ? (
        <section className="panel table-panel workflow-section module-modern parents-detail-panel">
          <div className="table-header">
            <div>
              <p className="section-kicker">{tr("Dossier responsable")}</p>
              <h2>{selectedParent.fullName}</h2>
            </div>
            <span className={statusPillClassName(selectedParent.status)}>{tr(statusLabel(selectedParent.status))}</span>
          </div>
          <div className="students-overview-grid">
            <article className="students-overview-card">
              <span>{tr("Rôle")}</span>
              <strong>{tr(roleLabel(selectedParent.parentalRole))}</strong>
              <small>{selectedParent.userUsername ? tr("Compte portail lié") : tr("Aucun compte portail")}</small>
            </article>
            <article className="students-overview-card">
              <span>{tr("Contact")}</span>
              <strong>{selectedParent.primaryPhone}</strong>
              <small>{selectedParent.email || tr("Email non renseigné")}</small>
            </article>
            <article className="students-overview-card">
              <span>{tr("Élèves liés")}</span>
              <strong>{selectedParent.childrenCount}</strong>
              <small>{selectedParent.primaryChildrenCount} {tr("contact principal")}</small>
            </article>
            <article className="students-overview-card">
              <span>{tr("Établissement")}</span>
              <strong>{SCHOOL_NAME}</strong>
              <small>{selectedParent.profession || tr("Profession non renseignée")}</small>
            </article>
          </div>
        </section>
      ) : null}
    </>
  );
}
