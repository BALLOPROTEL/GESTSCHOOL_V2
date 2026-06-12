export function ConstructionPageMosquee(): JSX.Element {
  return (
    <section className="mosquee-construction-page mosquee-v3-screen">
      <article className="panel module-modern mosquee-v3-hero">
        <div>
          <p className="section-kicker">Module en preparation</p>
          <h2>Mosquée</h2>
          <p>
            Le module sera active apres cadrage fonctionnel. Les espaces de suivi restent prets pour les
            membres, activites, dons et reçus sans melanger ces donnees aux ecrans scolaires.
          </p>
        </div>
        <span className="module-inline-pill">Donnees non disponibles</span>
      </article>

      <div className="mosquee-v3-grid">
        <article className="panel module-modern mosquee-v3-card">
          <p className="section-kicker">Suivi attendu</p>
          <h3>Membres & activites</h3>
          <p>Adhesions, presences aux activites, affectations et historique des actions.</p>
          <span className="status-pill is-muted">A cadrer</span>
        </article>
        <article className="panel module-modern mosquee-v3-card">
          <p className="section-kicker">Finance</p>
          <h3>Dons & reçus</h3>
          <p>Encaissements dedies, reçus et exports propres au perimetre mosquee.</p>
          <span className="status-pill is-muted">A connecter</span>
        </article>
        <article className="panel module-modern mosquee-v3-card">
          <p className="section-kicker">Conformite</p>
          <h3>Journal & exports</h3>
          <p>Traçabilite des operations, filtres par periode et exports administratifs.</p>
          <span className="status-pill is-muted">A specifier</span>
        </article>
      </div>

      <article className="panel module-modern mosquee-v3-roadmap">
        <div className="table-header">
          <div>
            <p className="section-kicker">Prochaine etape</p>
            <h3>Avant implementation</h3>
          </div>
        </div>
        <div className="priority-list">
          <div className="priority-item">
            <span className="priority-item-index">01</span>
            <strong>Valider le modele metier</strong>
            <small>Membres, activites, dons, reçus et droits d'acces.</small>
          </div>
          <div className="priority-item">
            <span className="priority-item-index">02</span>
            <strong>Brancher les API</strong>
            <small>Eviter tout mock ou stockage local des donnees sensibles.</small>
          </div>
          <div className="priority-item">
            <span className="priority-item-index">03</span>
            <strong>Ajouter la recette visuelle</strong>
            <small>Captures mobile, tablette et desktop en clair/sombre.</small>
          </div>
        </div>
      </article>
    </section>
  );
}
