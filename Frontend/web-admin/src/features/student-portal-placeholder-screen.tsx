export function StudentPortalPlaceholderScreen(): JSX.Element {
  return (
    <section className="panel table-panel workflow-section">
      <div className="table-header">
        <h2>Portail eleve</h2>
        <span className="module-header-badge">Non finalise</span>
      </div>
      <div className="notice-card notice-warning" role="status">
        <strong>Garde-fou Lot 0</strong>
        <p>
          Ce portail reste volontairement bloque en cadrage : les donnees eleve ne sont pas
          encore exposees comme un portail production complet.
        </p>
      </div>
      <p className="subtle">
        Le compte eleve est rattache a une fiche eleve. Les vues personnelles (notes,
        bulletins, absences et emploi du temps) seront branchees ici quand le portail
        eleve sera active.
      </p>
    </section>
  );
}
