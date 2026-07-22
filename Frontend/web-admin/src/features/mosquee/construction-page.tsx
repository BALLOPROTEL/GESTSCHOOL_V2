import { useI18n } from "../../shared/i18n-context";
export function ConstructionPageMosquee(): JSX.Element {
  const { t: tr } = useI18n();
  return (
    <section className="mosquee-construction-page mosquee-v3-screen">
      <article className="panel module-modern mosquee-v3-hero">
        <div>
          <p className="section-kicker">{tr("Module en preparation")}</p>
          <h2>{tr("Mosquée")}</h2>
          <p>
            {tr("Le module sera active apres cadrage fonctionnel. Les espaces de suivi restent prets pour les\n            membres, activites, dons et reçus sans melanger ces donnees aux ecrans scolaires.")}</p>
        </div>
        <span className="module-inline-pill">{tr("Donnees non disponibles")}</span>
      </article>

      <div className="mosquee-v3-grid">
        <article className="panel module-modern mosquee-v3-card">
          <p className="section-kicker">{tr("Suivi attendu")}</p>
          <h3>{tr("Membres & activites")}</h3>
          <p>{tr("Adhesions, presences aux activites, affectations et historique des actions.")}</p>
          <span className="status-pill is-muted">{tr("A cadrer")}</span>
        </article>
        <article className="panel module-modern mosquee-v3-card">
          <p className="section-kicker">{tr("Finance")}</p>
          <h3>{tr("Dons & reçus")}</h3>
          <p>{tr("Encaissements dedies, reçus et exports propres au perimetre mosquee.")}</p>
          <span className="status-pill is-muted">{tr("A connecter")}</span>
        </article>
        <article className="panel module-modern mosquee-v3-card">
          <p className="section-kicker">{tr("Conformite")}</p>
          <h3>{tr("Journal & exports")}</h3>
          <p>{tr("Traçabilite des operations, filtres par periode et exports administratifs.")}</p>
          <span className="status-pill is-muted">{tr("A specifier")}</span>
        </article>
      </div>

      <article className="panel module-modern mosquee-v3-roadmap">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Prochaine etape")}</p>
            <h3>{tr("Avant implementation")}</h3>
          </div>
        </div>
        <div className="priority-list">
          <div className="priority-item">
            <span className="priority-item-index">01</span>
            <strong>{tr("Valider le modele metier")}</strong>
            <small>{tr("Membres, activites, dons, reçus et droits d'acces.")}</small>
          </div>
          <div className="priority-item">
            <span className="priority-item-index">02</span>
            <strong>{tr("Brancher les API")}</strong>
            <small>{tr("Eviter tout mock ou stockage local des donnees sensibles.")}</small>
          </div>
          <div className="priority-item">
            <span className="priority-item-index">03</span>
            <strong>{tr("Ajouter la recette visuelle")}</strong>
            <small>{tr("Captures mobile, tablette et desktop en clair/sombre.")}</small>
          </div>
        </div>
      </article>
    </section>
  );
}
