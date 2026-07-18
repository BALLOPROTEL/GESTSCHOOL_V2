import type { ScreenId } from "../shared/types/app";
import { translateUiString, type UiLanguage } from "../shared/i18n";

export function PreviewLocalNotice(props: { uiLanguage: UiLanguage }): JSX.Element {
  return (
    <section className="notice-card notice-warning preview-local-notice" role="status">
      <strong>{translateUiString(props.uiLanguage, "Mode aperçu local")}</strong>
      <p>
        {translateUiString(
          props.uiLanguage,
          "Les données affichées sont des données de démonstration chargées dans le navigateur."
        )}{" "}
        {translateUiString(props.uiLanguage, "Elles ne sont pas persistées dans l’API ni dans PostgreSQL.")}
      </p>
    </section>
  );
}

export function FeatureUnavailableScreen(props: {
  actionLabel: string;
  featureLabel: string;
  onBackToAvailableScreen: () => void;
}): JSX.Element {
  return (
    <section className="panel table-panel" role="status">
      <p className="eyebrow">Fonctionnalité désactivée</p>
      <h2>{props.featureLabel}</h2>
      <p className="subtle">
        Cette fonctionnalité n’est pas activée dans cet environnement.
      </p>
      <div className="context-actions">
        <button type="button" className="button-ghost" onClick={props.onBackToAvailableScreen}>
          {props.actionLabel}
        </button>
      </div>
    </section>
  );
}

export function AppContextBar(props: {
  activeLabel: string;
  isEnrollmentsContext: boolean;
  isTeachersContext: boolean;
  onBackToDashboard: () => void;
  tab: ScreenId;
}): JSX.Element | null {
  const accountScreens = new Set<ScreenId>(["profile", "preferences", "activity", "billing"]);
  if (accountScreens.has(props.tab)) return null;
  if (props.tab === "dashboard") return null;
  return (
    <section key={`context-${props.tab}`} className="panel context-bar">
      <div className="context-copy">
        <p className="eyebrow">Module actif</p>
        <h2>{props.activeLabel}</h2>
        {props.isEnrollmentsContext ? (
          <p className="section-lead">Gérez les inscriptions et placements académiques des élèves.</p>
        ) : null}
        {props.isTeachersContext ? (
          <p className="section-lead">
            Gérez les fiches enseignants, leurs compétences, leurs affectations, leur charge horaire et leurs
            documents administratifs.
          </p>
        ) : null}
      </div>
      <div className="context-actions">
        <button type="button" className="button-ghost" onClick={props.onBackToDashboard}>
          Retour tableau de bord
        </button>
      </div>
    </section>
  );
}

export function AppFooter(props: {
  apiConnectionStatus: string;
  apiStatusText: string;
  lastSyncLabel: string;
  schoolName: string;
  schoolYearLabel: string;
}): JSX.Element {
  return (
    <footer className="panel app-footer app-footer-minimal">
      <div className="footer-head">
        <strong>{props.schoolName}</strong>
        <div className="footer-meta">
          <span>Année : {props.schoolYearLabel}</span>
          <span>Dernière sync : {props.lastSyncLabel}</span>
          {props.apiConnectionStatus !== "online" ? <span>{props.apiStatusText}</span> : null}
        </div>
      </div>
    </footer>
  );
}
