import type { ParentRecord } from "../../../shared/types/app";
import { SCHOOL_NAME, roleLabel } from "../parents-screen-model";

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
            <h2>Liste parents</h2>
          </div>
          <div className="students-table-toolbar">
            <label className="students-search-field">
              <span>Recherche rapide</span>
              <input
                className="search-input"
                placeholder="Nom, telephone, email"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
          </div>
        </div>
        <p className="section-lead">
          Un parent est une personne metier. Le compte portail reste un rattachement optionnel.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Parent</th>
                <th>Role</th>
                <th>Telephone</th>
                <th>Email</th>
                <th>Enfants</th>
                <th>Portail</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="empty-row">Chargement...</td></tr>
              ) : shownParents.length === 0 ? (
                <tr><td colSpan={8} className="empty-row">Aucun parent.</td></tr>
              ) : (
                shownParents.map((parent) => (
                  <tr key={parent.id}>
                    <td>{parent.fullName}</td>
                    <td>{roleLabel(parent.parentalRole)}</td>
                    <td>{parent.primaryPhone}</td>
                    <td>{parent.email || "-"}</td>
                    <td>{parent.childrenCount}</td>
                    <td>{parent.userUsername || "Non lie"}</td>
                    <td>{parent.status}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="button-ghost" onClick={() => onSelectParent(parent.id)}>
                          Detail
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
        <section className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Detail parent</p>
              <h2>{selectedParent.fullName}</h2>
            </div>
            <span className="students-overview-status">{selectedParent.status}</span>
          </div>
          <div className="students-overview-grid">
            <article className="students-overview-card">
              <span>Role</span>
              <strong>{roleLabel(selectedParent.parentalRole)}</strong>
              <small>{selectedParent.userUsername ? "Compte portail lie" : "Sans compte portail"}</small>
            </article>
            <article className="students-overview-card">
              <span>Contact</span>
              <strong>{selectedParent.primaryPhone}</strong>
              <small>{selectedParent.email || "Email non renseigne"}</small>
            </article>
            <article className="students-overview-card">
              <span>Enfants lies</span>
              <strong>{selectedParent.childrenCount}</strong>
              <small>{selectedParent.primaryChildrenCount} contact principal</small>
            </article>
            <article className="students-overview-card">
              <span>Etablissement</span>
              <strong>{SCHOOL_NAME}</strong>
              <small>{selectedParent.profession || "Profession non renseignee"}</small>
            </article>
          </div>
        </section>
      ) : null}
    </>
  );
}
