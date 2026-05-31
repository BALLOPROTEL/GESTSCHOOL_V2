import { useEffect, useState, type FormEvent, type RefObject } from "react";

import type { FieldErrors, ThemeMode, UserSelfProfile } from "../../shared/types/app";
import type { UiLanguage } from "../../shared/i18n";

export type PasswordFieldKey = "currentPassword" | "newPassword" | "confirmPassword";

export type ProfileFormState = {
  displayName: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PreferenceFormState = {
  language: UiLanguage;
  theme: ThemeMode;
  timeZone: string;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
};

type ProfilePageProps = {
  accountTypeLabel: string;
  activityItems: PremiumActivityItem[];
  avatarInputRef: RefObject<HTMLInputElement>;
  avatarInitials: string;
  avatarUrl?: string;
  bio: string;
  changingPassword: boolean;
  createdAtLabel: string;
  currentRoleLabel: string;
  email: string;
  fullName: string;
  isEditingProfile: boolean;
  lastLoginLabel: string;
  loading: boolean;
  onAvatarFileSelected: (file: File | undefined) => void;
  onCancelProfileEdit: () => void;
  onChangePasswordField: (key: PasswordFieldKey, value: string) => void;
  onLogoutAllDevices: () => void;
  onOpenAvatarPicker: () => void;
  onOpenPasswordEditor: () => void;
  onOpenProfileEditor: () => void;
  onPreferenceChange: <Key extends keyof PreferenceFormState>(key: Key, value: PreferenceFormState[Key]) => void;
  onProfileFieldChange: <Key extends keyof ProfileFormState>(key: Key, value: ProfileFormState[Key]) => void;
  onRemoveAvatar: () => void;
  onSubmitPassword: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitPreferences: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitProfile: (event: FormEvent<HTMLFormElement>) => void;
  onTogglePasswordVisibility: (key: PasswordFieldKey) => void;
  onViewSessions: () => void;
  onViewPermissions: () => void;
  passwordErrors: FieldErrors;
  passwordForm: PasswordFormState;
  passwordPanelOpen: boolean;
  personalInfoRows: ProfileInfoRow[];
  preferencesForm: PreferenceFormState;
  profile: UserSelfProfile;
  profileErrors: FieldErrors;
  profileForm: ProfileFormState;
  removingAvatar: boolean;
  savingPreferences: boolean;
  savingProfile: boolean;
  schoolName: string;
  schoolYearLabel: string;
  security: PremiumSecurityState;
  statusLabel: string;
  t: (value: string) => string;
  uploadingAvatar: boolean;
  visiblePasswordFields: Record<PasswordFieldKey, boolean>;
};

export type ProfileInfoRow = {
  label: string;
  value: string;
};

export type PremiumActivityItem = {
  id: string;
  icon: PremiumIconName;
  tone: "blue" | "green" | "orange" | "purple";
  title: string;
  time: string;
};

export type PremiumSecurityState = {
  passwordPolicyLabel: string;
  activeSessionsLabel: string;
};

type PremiumIconName =
  | "activity"
  | "bell"
  | "calendar"
  | "camera"
  | "chevron"
  | "edit"
  | "email"
  | "export"
  | "eye"
  | "eyeOff"
  | "lock"
  | "logout"
  | "phone"
  | "role"
  | "school"
  | "shield"
  | "student"
  | "user";

function PremiumIcon({ name }: { name: PremiumIconName }): JSX.Element {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2 } as const;
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      {name === "camera" ? <><path {...common} d="M4 8h3l1.5-2h7L17 8h3v10H4z" /><circle {...common} cx="12" cy="13" r="3" /></> : null}
      {name === "edit" ? <><path {...common} d="m4 20 4.6-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path {...common} d="m14 6 4 4" /></> : null}
      {name === "email" ? <><rect {...common} x="3" y="5" width="18" height="14" rx="2" /><path {...common} d="m4 7 8 6 8-6" /></> : null}
      {name === "phone" ? <path {...common} d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.2 19.2 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6.3 6.3l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2Z" /> : null}
      {name === "calendar" ? <><rect {...common} x="3" y="4" width="18" height="18" rx="2" /><path {...common} d="M16 2v4M8 2v4M3 10h18" /></> : null}
      {name === "lock" ? <><rect {...common} x="4" y="10" width="16" height="11" rx="2" /><path {...common} d="M8 10V7a4 4 0 0 1 8 0v3" /></> : null}
      {name === "shield" ? <path {...common} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /> : null}
      {name === "chevron" ? <path {...common} d="m9 18 6-6-6-6" /> : null}
      {name === "logout" ? <><path {...common} d="M10 17 15 12l-5-5" /><path {...common} d="M15 12H3" /><path {...common} d="M21 19V5a2 2 0 0 0-2-2h-5" /></> : null}
      {name === "user" ? <><path {...common} d="M20 21a8 8 0 0 0-16 0" /><circle {...common} cx="12" cy="7" r="4" /></> : null}
      {name === "school" ? <><path {...common} d="M3 10 12 4l9 6-9 6-9-6Z" /><path {...common} d="M7 13v4c3 2 7 2 10 0v-4" /></> : null}
      {name === "bell" ? <><path {...common} d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path {...common} d="M10 21h4" /></> : null}
      {name === "activity" ? <path {...common} d="M22 12h-4l-3 8-6-16-3 8H2" /> : null}
      {name === "student" ? <><path {...common} d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path {...common} d="M4 21a8 8 0 0 1 16 0" /></> : null}
      {name === "export" ? <><path {...common} d="M12 3v12" /><path {...common} d="m7 10 5 5 5-5" /><path {...common} d="M5 21h14" /></> : null}
      {name === "role" ? <><path {...common} d="M12 22s7-3.5 7-9V5l-7-3-7 3v8c0 5.5 7 9 7 9Z" /><path {...common} d="m9.5 12 1.7 1.7L15 9.8" /></> : null}
      {name === "eye" ? <><path {...common} d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle {...common} cx="12" cy="12" r="3" /></> : null}
      {name === "eyeOff" ? <><path {...common} d="M3 3 21 21" /><path {...common} d="M10.6 10.6a3 3 0 0 0 3.8 3.8" /><path {...common} d="M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-3.1 4.3" /><path {...common} d="M6.6 6.7A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.1-.9" /></> : null}
    </svg>
  );
}

const renderError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {errors[key]}
    </span>
  ) : null;

const passwordToggleLabel = (
  t: (value: string) => string,
  key: PasswordFieldKey,
  visible: boolean
): string => {
  const labels: Record<PasswordFieldKey, [string, string]> = {
    currentPassword: ["Afficher le mot de passe actuel", "Masquer le mot de passe actuel"],
    newPassword: ["Afficher le nouveau mot de passe", "Masquer le nouveau mot de passe"],
    confirmPassword: ["Afficher la confirmation du mot de passe", "Masquer la confirmation du mot de passe"]
  };
  return t(labels[key][visible ? 1 : 0]);
};

export function ProfilePage(props: ProfilePageProps): JSX.Element {
  return (
    <div className="premium-profile-screen" aria-busy={props.loading}>
      <section className="premium-profile-header">
        <div>
          <h1>{props.t("Mon profil")}</h1>
          <p>{props.t("Gérez vos informations personnelles et vos préférences.")}</p>
        </div>
        <button type="button" className="premium-profile-primary" onClick={props.onOpenProfileEditor}>
          <PremiumIcon name="edit" />
          {props.t("Modifier le profil")}
        </button>
      </section>

      <ProfileHero {...props} />

      <div className="premium-profile-grid">
        <PersonalInfoCard {...props} />
        <SecurityCard {...props} />
        <PreferencesCard {...props} />
        <ActivityCard activityItems={props.activityItems} t={props.t} />
      </div>

      <RolesCard {...props} />
    </div>
  );
}

function ProfileHero(props: ProfilePageProps): JSX.Element {
  return (
    <section className="premium-profile-card premium-profile-hero">
      <div className="premium-profile-avatar-stack">
        <ProfileAvatar avatarInitials={props.avatarInitials} avatarUrl={props.avatarUrl} />
        <input
          ref={props.avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => props.onAvatarFileSelected(event.target.files?.[0])}
        />
        <button
          type="button"
          className="premium-avatar-camera"
          aria-label={props.t("Changer la photo")}
          onClick={props.onOpenAvatarPicker}
        >
          <PremiumIcon name="camera" />
        </button>
      </div>

      <div className="premium-profile-hero-main">
        <h2>{props.fullName}</h2>
        <span className="premium-role-badge">{props.currentRoleLabel}</span>
        <p><PremiumIcon name="email" /> <span title={props.email}>{props.email}</span></p>
        <p><PremiumIcon name="phone" /> <span>{props.profile.user.phone || "-"}</span></p>
        <p><PremiumIcon name="calendar" /> <span>{props.t("Compte créé le")} {props.createdAtLabel}</span></p>
      </div>

      <div className="premium-profile-bio">
        <h3>{props.t("À propos de moi")}</h3>
        <p>{props.bio}</p>
        <div className="premium-profile-mini-context">
          <span><PremiumIcon name="school" /> {props.schoolName}</span>
          <span>{props.schoolYearLabel}</span>
        </div>
      </div>
    </section>
  );
}

function ProfileAvatar({
  avatarInitials,
  avatarUrl
}: {
  avatarInitials: string;
  avatarUrl?: string;
}): JSX.Element {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedAvatarUrl(null);
  }, [avatarUrl]);

  const canRenderAvatar = Boolean(avatarUrl && failedAvatarUrl !== avatarUrl);

  return (
    <span className="premium-profile-avatar">
      {canRenderAvatar ? (
        <img src={avatarUrl} alt="" onError={() => setFailedAvatarUrl(avatarUrl || null)} />
      ) : (
        avatarInitials
      )}
    </span>
  );
}

function PersonalInfoCard(props: ProfilePageProps): JSX.Element {
  return (
    <section className="premium-profile-card">
      <CardTitle title={props.t("Informations personnelles")} />
      <div className="premium-info-list">
        {props.personalInfoRows.map((row) => (
          <div className="premium-info-row" key={row.label}>
            <span>{props.t(row.label)}</span>
            <strong>{props.t(row.value)}</strong>
          </div>
        ))}
      </div>

      {props.isEditingProfile ? (
        <form className="premium-profile-edit-form visible" onSubmit={props.onSubmitProfile}>
          <label>
            {props.t("Nom affiché")} *
            <input
              value={props.profileForm.displayName}
              onChange={(event) => props.onProfileFieldChange("displayName", event.target.value)}
            />
            {renderError(props.profileErrors, "displayName")}
          </label>
          <label>
            {props.t("Prénom")}
            <input
              value={props.profileForm.firstName}
              onChange={(event) => props.onProfileFieldChange("firstName", event.target.value)}
            />
            {renderError(props.profileErrors, "firstName")}
          </label>
          <label>
            {props.t("Nom")}
            <input
              value={props.profileForm.lastName}
              onChange={(event) => props.onProfileFieldChange("lastName", event.target.value)}
            />
            {renderError(props.profileErrors, "lastName")}
          </label>
          <label>
            {props.t("Téléphone")}
            <input
              value={props.profileForm.phone}
              onChange={(event) => props.onProfileFieldChange("phone", event.target.value)}
            />
            {renderError(props.profileErrors, "phone")}
          </label>
          <div className="premium-edit-actions">
            <button type="submit" className="premium-profile-primary" disabled={props.savingProfile}>
              {props.savingProfile ? props.t("Enregistrement...") : props.t("Enregistrer les modifications")}
            </button>
            <button type="button" className="premium-profile-secondary" onClick={props.onCancelProfileEdit}>
              {props.t("Annuler")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function SecurityCard(props: ProfilePageProps): JSX.Element {
  return (
    <section className="premium-profile-card">
      <CardTitle title={props.t("Sécurité du compte")} />
      <div className="premium-info-list">
        <div className="premium-info-row">
          <span>{props.t("Mot de passe")}</span>
          <strong className="premium-password-summary">
            ************
            <button type="button" className="premium-row-action" onClick={props.onOpenPasswordEditor}>
              {props.t("Modifier")}
            </button>
          </strong>
        </div>
        <div className="premium-info-row">
          <span>{props.t("Politique mot de passe")}</span>
          <strong className="premium-state-success">{props.security.passwordPolicyLabel}</strong>
        </div>
        <div className="premium-info-row">
          <span>{props.t("Sessions actives")}</span>
          <button type="button" className="premium-inline-link" onClick={props.onViewSessions}>
            {props.security.activeSessionsLabel}
            <PremiumIcon name="chevron" />
          </button>
        </div>
        <div className="premium-info-row">
          <span>{props.t("Dernière connexion")}</span>
          <strong>{props.t(props.lastLoginLabel)}</strong>
        </div>
      </div>

      {props.passwordPanelOpen ? (
        <form className="premium-password-editor" onSubmit={props.onSubmitPassword}>
          {([
            ["currentPassword", "Mot de passe actuel *", "current-password"],
            ["newPassword", "Nouveau mot de passe *", "new-password"],
            ["confirmPassword", "Confirmation du nouveau mot de passe *", "new-password"]
          ] as [PasswordFieldKey, string, string][]).map(([key, label, autocomplete]) => {
            const visible = props.visiblePasswordFields[key];
            const toggleLabel = passwordToggleLabel(props.t, key, visible);

            return (
              <label key={key} className="premium-password-field">
                {props.t(label)}
                <span className="premium-password-input">
                  <input
                    aria-label={props.t(label)}
                    autoComplete={autocomplete}
                    type={visible ? "text" : "password"}
                    value={props.passwordForm[key]}
                    onChange={(event) => props.onChangePasswordField(key, event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={toggleLabel}
                    title={toggleLabel}
                    onClick={() => props.onTogglePasswordVisibility(key)}
                  >
                    <PremiumIcon name={visible ? "eyeOff" : "eye"} />
                  </button>
                </span>
                {renderError(props.passwordErrors, key)}
              </label>
            );
          })}
          <p className="premium-password-hint">
            {props.t("Le mot de passe doit contenir au moins 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial.")}
          </p>
          <button type="submit" className="premium-profile-primary" disabled={props.changingPassword}>
            {props.changingPassword ? props.t("Modification...") : props.t("Changer le mot de passe")}
          </button>
        </form>
      ) : null}

      <button type="button" className="premium-logout-devices" onClick={props.onLogoutAllDevices}>
        <PremiumIcon name="logout" />
        {props.t("Se déconnecter de tous les appareils")}
      </button>
    </section>
  );
}

function PreferencesCard(props: ProfilePageProps): JSX.Element {
  return (
    <section className="premium-profile-card">
      <CardTitle title={props.t("Préférences")} />
      <form className="premium-preferences-form" onSubmit={props.onSubmitPreferences}>
        <label className="premium-select-row">
          <span>{props.t("Langue")}</span>
          <select
            value={props.preferencesForm.language}
            onChange={(event) => props.onPreferenceChange("language", event.target.value as UiLanguage)}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <label className="premium-select-row">
          <span>{props.t("Fuseau horaire")}</span>
          <select
            value={props.preferencesForm.timeZone}
            onChange={(event) => props.onPreferenceChange("timeZone", event.target.value)}
          >
            <option value="Europe/Paris">(GMT+01:00) Paris</option>
            <option value="Africa/Dakar">(GMT+00:00) Dakar</option>
            <option value="Africa/Bamako">(GMT+00:00) Bamako</option>
          </select>
        </label>
        <label className="premium-select-row">
          <span>{props.t("Thème")}</span>
          <select
            value={props.preferencesForm.theme}
            onChange={(event) => props.onPreferenceChange("theme", event.target.value as ThemeMode)}
          >
            <option value="light">{props.t("Clair")}</option>
            <option value="dark">{props.t("Sombre")}</option>
          </select>
        </label>
        <SwitchRow
          checked={props.preferencesForm.emailNotificationsEnabled}
          label={props.t("Notifications par email")}
          onChange={(checked) => props.onPreferenceChange("emailNotificationsEnabled", checked)}
        />
        <SwitchRow
          checked={props.preferencesForm.pushNotificationsEnabled}
          label={props.t("Notifications push")}
          onChange={(checked) => props.onPreferenceChange("pushNotificationsEnabled", checked)}
        />
        <button type="submit" className="premium-profile-secondary" disabled={props.savingPreferences}>
          {props.savingPreferences ? props.t("Enregistrement...") : props.t("Enregistrer les préférences")}
        </button>
      </form>
    </section>
  );
}

function ActivityCard({ activityItems, t }: { activityItems: PremiumActivityItem[]; t: (value: string) => string }): JSX.Element {
  return (
    <section className="premium-profile-card">
      <CardTitle title={t("Activité récente")} />
      {activityItems.length > 0 ? (
        <div className="premium-activity-list">
          {activityItems.map((item) => (
            <div className="premium-activity-row" key={item.id}>
              <span className={`premium-activity-icon tone-${item.tone}`}>
                <PremiumIcon name={item.icon} />
              </span>
              <strong>{t(item.title)}</strong>
              <time>{t(item.time)}</time>
            </div>
          ))}
        </div>
      ) : (
        <p className="premium-empty-state">{t("Aucune activité récente disponible.")}</p>
      )}
    </section>
  );
}

function RolesCard(props: ProfilePageProps): JSX.Element {
  return (
    <section className="premium-profile-card premium-role-card">
      <CardTitle title={props.t("Mes rôles et permissions")} />
      <div className="premium-role-content">
        <span className="premium-role-icon">
          <PremiumIcon name="shield" />
        </span>
        <div>
          <h3>{props.currentRoleLabel}</h3>
          <p>{props.t("Accès complet aux fonctionnalités autorisées de la plateforme.")}</p>
        </div>
        <span className="premium-role-badge soft">{props.t("Rôle principal")}</span>
        <button type="button" className="premium-profile-secondary" onClick={props.onViewPermissions}>
          {props.t("Voir les permissions")}
        </button>
      </div>
    </section>
  );
}

function CardTitle({ title }: { title: string }): JSX.Element {
  return <h2 className="premium-card-title">{title}</h2>;
}

function SwitchRow({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label className="premium-switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="premium-switch" aria-hidden="true" />
    </label>
  );
}
