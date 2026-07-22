import { useI18n } from "../shared/i18n-context";
export function StudentPortalPlaceholderScreen(): JSX.Element {
  const { t: tr } = useI18n();
  return (
    <section className="panel table-panel workflow-section">
      <div className="table-header">
        <h2>{tr("Portail eleve")}</h2>
        <span className="module-header-badge">{tr("Non finalise")}</span>
      </div>
      <div className="notice-card notice-warning" role="status">
        <strong>{tr("Garde-fou Lot 0")}</strong>
        <p>
          {tr("Ce portail reste volontairement bloque en cadrage : les donnees eleve ne sont pas\n          encore exposees comme un portail production complet.")}</p>
      </div>
      <p className="subtle">
        {tr("Le compte eleve est rattache a une fiche eleve. Les vues personnelles (notes,\n        bulletins, absences et emploi du temps) seront branchees ici quand le portail\n        eleve sera active.")}</p>
    </section>
  );
}
