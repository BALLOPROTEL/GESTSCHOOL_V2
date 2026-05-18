import type { ParentRecord } from "../../../shared/types/app";
import { SCHOOL_NAME, roleLabel, statusLabel, statusPillClassName } from "../parents-screen-model";

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

  return (
    <>
      <section className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Responsables</p>
            <h2>Liste des responsables</h2>
          </div>
          <div className="students-table-toolbar">
            <label className="students-search-field">
              <span>Recherche rapide</span>
              <input
                className="search-input"
                placeholder="Nom, téléphone, email"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
          </div>
        </div>
        <p className="section-lead">
          Un responsable est une personne rattachée à un ou plusieurs élèves. Le compte portail reste optionnel.
        </p>
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>Responsable</th>
                <th>Rôle</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Élèves liés</th>
                <th>Portail</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="empty-row">Chargement...</td></tr>
              ) : shownParents.length === 0 ? (
                <tr><td colSpan={8} className="empty-row">Aucun responsable enregistré.</td></tr>
              ) : (
                shownParents.map((parent) => (
                  <tr key={parent.id}>
                    <td data-label="Responsable">{parent.fullName}</td>
                    <td data-label="Rôle">{roleLabel(parent.parentalRole)}</td>
                    <td data-label="Téléphone">{parent.primaryPhone}</td>
                    <td data-label="Email">{parent.email || "-"}</td>
                    <td data-label="Élèves liés">{parent.childrenCount}</td>
                    <td data-label="Portail">{parent.userUsername ? "Lié" : "Non lié"}</td>
                    <td data-label="Statut">
                      <span className={statusPillClassName(parent.status)}>{statusLabel(parent.status)}</span>
                    </td>
                    <td data-label="Actions">
                      <div className="row-actions">
                        <button type="button" className="button-ghost" onClick={() => onSelectParent(parent.id)}>
                          Voir
                        </button>
                        <button type="button" className="button-ghost" onClick={() => onEditParent(parent)}>
                          Modifier
                        </button>
                        <button type="button" className="button-danger" onClick={() => onArchiveParent(parent.id)}>
                          Archiver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedParent ? (
        <section className="panel table-panel workflow-section module-modern parents-detail-panel">
          <div className="table-header">
            <div>
              <p className="section-kicker">Dossier responsable</p>
              <h2>{selectedParent.fullName}</h2>
            </div>
            <span className={statusPillClassName(selectedParent.status)}>{statusLabel(selectedParent.status)}</span>
          </div>
          <div className="students-overview-grid">
            <article className="students-overview-card">
              <span>Rôle</span>
              <strong>{roleLabel(selectedParent.parentalRole)}</strong>
              <small>{selectedParent.userUsername ? "Compte portail lié" : "Aucun compte portail"}</small>
            </article>
            <article className="students-overview-card">
              <span>Contact</span>
              <strong>{selectedParent.primaryPhone}</strong>
              <small>{selectedParent.email || "Email non renseigné"}</small>
            </article>
            <article className="students-overview-card">
              <span>Élèves liés</span>
              <strong>{selectedParent.childrenCount}</strong>
              <small>{selectedParent.primaryChildrenCount} contact principal</small>
            </article>
            <article className="students-overview-card">
              <span>Établissement</span>
              <strong>{SCHOOL_NAME}</strong>
              <small>{selectedParent.profession || "Profession non renseignée"}</small>
            </article>
          </div>
        </section>
      ) : null}
    </>
  );
}
