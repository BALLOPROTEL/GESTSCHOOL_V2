import { FormEvent, useEffect, useMemo, useState } from "react";

import { translateUiString, UI_MESSAGES, type UiLanguage } from "../../shared/i18n";
import { toUiErrorMessage } from "../../shared/services/api-errors";
import type {
  SchoolYear,
  Session,
  ThemeMode,
  UserAccount,
  UserActivityItem,
  UserSelfProfile
} from "../../shared/types/app";
import {
  fetchMyActivity,
  fetchMyProfile,
  type ProfileApiClient,
  updateMyProfile
} from "./profile-service";

type BaseProps = {
  api: ProfileApiClient;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  remoteEnabled?: boolean;
  schoolName: string;
  schoolYears: SchoolYear[];
  session: Session;
  uiLanguage: UiLanguage;
  users: UserAccount[];
};

type PreferencesScreenProps = BaseProps & {
  onLanguageChange: (language: UiLanguage) => void;
  onThemeChange: (theme: ThemeMode) => void;
  themeMode: ThemeMode;
};

const buildFallbackProfile = (
  session: Session,
  users: UserAccount[],
  schoolYears: SchoolYear[],
  schoolName: string
): UserSelfProfile => {
  const matchedUser =
    users.find((item) => item.id === session.user.id) ||
    users.find((item) => item.username === session.user.username) ||
    users.find((item) => item.email && item.email === session.user.username);
  const activeSchoolYear = schoolYears.find((item) => item.isActive) || schoolYears[0];
  const fallbackUser = matchedUser || {
    id: session.user.id || "session-user",
    tenantId: session.tenantId,
    username: session.user.username,
    role: session.user.role as UserAccount["role"],
    accountType: "STAFF" as const,
    displayName: session.user.displayName || session.user.username,
    status: session.user.status || "ACTIVE",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return {
    user: fallbackUser,
    context: {
      tenantId: session.tenantId,
      tenantName: schoolName,
      activeSchoolYear: activeSchoolYear
        ? {
            id: activeSchoolYear.id,
            code: activeSchoolYear.code,
            label: activeSchoolYear.label || activeSchoolYear.code,
            status: activeSchoolYear.status || "-",
            isActive: activeSchoolYear.isActive
          }
        : undefined,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris"
    },
    permissions: []
  };
};

const PageShell = (props: {
  children: JSX.Element;
  description: string;
  eyebrow: string;
  title: string;
  uiLanguage: UiLanguage;
}): JSX.Element => {
  const t = (value: string): string => translateUiString(props.uiLanguage, value);
  return (
    <div className="profile-screen profile-screen-compact">
      <section className="panel profile-page-header">
        <div>
          <p className="eyebrow">{t(props.eyebrow)}</p>
          <h2>{t(props.title)}</h2>
          <p>{t(props.description)}</p>
        </div>
      </section>
      {props.children}
    </div>
  );
};

export function PreferencesScreen({
  api,
  onError,
  onLanguageChange,
  onNotice,
  onThemeChange,
  remoteEnabled = true,
  schoolName,
  schoolYears,
  session,
  themeMode,
  uiLanguage,
  users
}: PreferencesScreenProps): JSX.Element {
  const t = (value: string): string => translateUiString(uiLanguage, value);
  const fallbackProfile = useMemo(
    () => buildFallbackProfile(session, users, schoolYears, schoolName),
    [schoolName, schoolYears, session, users]
  );
  const [form, setForm] = useState({
    language: uiLanguage,
    theme: themeMode,
    emailNotificationsEnabled: true,
    systemNotificationsEnabled: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, language: uiLanguage, theme: themeMode }));
  }, [themeMode, uiLanguage]);

  useEffect(() => {
    let cancelled = false;
    if (!remoteEnabled) return () => {
      cancelled = true;
    };
    void fetchMyProfile(api)
      .then((profile) => {
        if (cancelled) return;
        setForm((prev) => ({
          ...prev,
          emailNotificationsEnabled:
            profile.preferences?.emailNotificationsEnabled ?? prev.emailNotificationsEnabled,
          systemNotificationsEnabled:
            profile.preferences?.systemNotificationsEnabled ?? prev.systemNotificationsEnabled
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, remoteEnabled]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      if (remoteEnabled) {
        await updateMyProfile(api, {
          displayName: fallbackProfile.user.displayName || fallbackProfile.user.username,
          phone: fallbackProfile.user.phone || "",
          language: form.language,
          theme: form.theme,
          emailNotificationsEnabled: form.emailNotificationsEnabled,
          systemNotificationsEnabled: form.systemNotificationsEnabled
        });
      }
      onLanguageChange(form.language);
      onThemeChange(form.theme);
      onNotice(UI_MESSAGES.preferencesSaved);
      onError(null);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      eyebrow="Compte utilisateur"
      title="Préférences"
      description="Réglez la langue, le thème et les notifications de votre espace."
      uiLanguage={uiLanguage}
    >
      <section className="panel profile-tabs-panel">
        <form className="profile-form-grid compact" onSubmit={(event) => void submit(event)}>
          <label>
            {t("Langue")}
            <select
              value={form.language}
              onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value as UiLanguage }))}
            >
              <option value="fr">FR - Français</option>
              <option value="en">EN - Anglais</option>
              <option value="ar">AR - Arabe</option>
            </select>
          </label>
          <label>
            {t("Thème")}
            <select
              value={form.theme}
              onChange={(event) => setForm((prev) => ({ ...prev, theme: event.target.value as ThemeMode }))}
            >
              <option value="light">{t("Clair")}</option>
              <option value="dark">{t("Sombre")}</option>
            </select>
          </label>
          <label className="profile-toggle-row compact-checkbox">
            <input
              type="checkbox"
              checked={form.emailNotificationsEnabled}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, emailNotificationsEnabled: event.target.checked }))
              }
            />
            {t("Notifications email activées")}
          </label>
          <label className="profile-toggle-row compact-checkbox">
            <input
              type="checkbox"
              checked={form.systemNotificationsEnabled}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, systemNotificationsEnabled: event.target.checked }))
              }
            />
            {t("Notifications système activées")}
          </label>
          <div className="profile-form-actions inline">
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? t("Enregistrement...") : t("Enregistrer les préférences")}
            </button>
          </div>
        </form>
      </section>
    </PageShell>
  );
}

export function ActivityScreen({
  api,
  onError,
  remoteEnabled = true,
  uiLanguage
}: BaseProps): JSX.Element {
  const t = (value: string): string => translateUiString(uiLanguage, value);
  const [activity, setActivity] = useState<UserActivityItem[]>([]);
  const [loading, setLoading] = useState(remoteEnabled);

  useEffect(() => {
    let cancelled = false;
    if (!remoteEnabled) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    void fetchMyActivity(api)
      .then((rows) => {
        if (!cancelled) setActivity(rows);
      })
      .catch((error) => {
        if (!cancelled) onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, onError, remoteEnabled]);

  return (
    <PageShell
      eyebrow="Compte utilisateur"
      title="Journal d’activité"
      description="Consultez les dernières actions de sécurité et de compte disponibles."
      uiLanguage={uiLanguage}
    >
      <section className="panel profile-tabs-panel" aria-busy={loading}>
        {activity.length > 0 ? (
          <div className="profile-activity-list">
            {activity.map((item) => (
              <article key={item.id} className="profile-activity-item">
                <strong>{item.action}</strong>
                <span>{item.resource}</span>
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state-block">{t("Aucune activité récente disponible.")}</p>
        )}
      </section>
    </PageShell>
  );
}

export function BillingScreen({ schoolName, uiLanguage }: BaseProps): JSX.Element {
  const t = (value: string): string => translateUiString(uiLanguage, value);
  return (
    <PageShell
      eyebrow="Compte utilisateur"
      title="Facturation"
      description="Les informations de facturation sont séparées du profil personnel."
      uiLanguage={uiLanguage}
    >
      <section className="panel profile-tabs-panel">
        <div className="profile-details-grid compact">
          <div>
            <span>{t("Établissement")}</span>
            <strong>{schoolName}</strong>
          </div>
          <div>
            <span>{t("Statut")}</span>
            <strong>{t("Non disponible")}</strong>
          </div>
          <div>
            <span>{t("Plan")}</span>
            <strong>-</strong>
          </div>
        </div>
        <p className="empty-state-block">{t("Aucune information de facturation utilisateur disponible.")}</p>
      </section>
    </PageShell>
  );
}
