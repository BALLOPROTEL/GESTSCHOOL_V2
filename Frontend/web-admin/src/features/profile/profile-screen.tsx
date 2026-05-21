import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ROLE_LABELS } from "../../shared/constants/domain";
import { translateUiString, type UiLanguage } from "../../shared/i18n";
import type {
  FieldErrors,
  SchoolYear,
  Session,
  UserAccount,
  UserSelfProfile
} from "../../shared/types/app";
import {
  changeMyPassword,
  fetchMyProfile,
  removeMyAvatar,
  type ProfileApiClient,
  updateMyProfile,
  uploadMyAvatar
} from "./profile-service";

type ProfileScreenProps = {
  api: ProfileApiClient;
  currentRoleLabel: string;
  locale: string;
  onError: (message: string | null) => void;
  onBackToDashboard: () => void;
  onNotice: (message: string | null) => void;
  onProfileChange?: (profile: UserSelfProfile) => void;
  remoteEnabled?: boolean;
  schoolName: string;
  schoolYears: SchoolYear[];
  session: Session;
  uiLanguage: UiLanguage;
  users: UserAccount[];
};

type ProfileTab = "identity" | "security" | "sessions";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  STAFF: "Staff interne",
  TEACHER: "Enseignant",
  PARENT: "Parent",
  STUDENT: "Élève"
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  ARCHIVED: "Archivé",
  DISABLED: "Désactivé",
  INACTIVE: "Inactif",
  PENDING_ACTIVATION: "En attente d’activation"
};

const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,128}$/;
const PASSWORD_HINT =
  "Le mot de passe doit contenir au moins 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial.";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const lookup = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};

const initialsFrom = (value: string): string => {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "U").toUpperCase();
};

const formatDate = (value: string | undefined, locale: string): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale);
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
  const fallbackUser: UserAccount = matchedUser || {
    id: session.user.id || "session-user",
    tenantId: session.tenantId,
    username: session.user.username,
    role: session.user.role as UserAccount["role"],
    roleId: session.user.role as UserAccount["role"],
    accountType: (session.user.accountType as UserAccount["accountType"]) || "STAFF",
    email: session.user.email || (session.user.username.includes("@") ? session.user.username : undefined),
    phone: session.user.phone,
    displayName: session.user.displayName || session.user.username,
    mustChangePasswordAtFirstLogin: false,
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

const renderError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {errors[key]}
    </span>
  ) : null;

export function ProfileScreen({
  api,
  currentRoleLabel,
  locale,
  onBackToDashboard,
  onError,
  onNotice,
  onProfileChange,
  remoteEnabled = true,
  schoolName,
  schoolYears,
  session,
  uiLanguage,
  users
}: ProfileScreenProps): JSX.Element {
  const t = (value: string): string => translateUiString(uiLanguage, value);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackProfile = useMemo(
    () => buildFallbackProfile(session, users, schoolYears, schoolName),
    [schoolName, schoolYears, session, users]
  );
  const [profile, setProfile] = useState<UserSelfProfile>(fallbackProfile);
  const [activeTab, setActiveTab] = useState<ProfileTab>("identity");
  const [loading, setLoading] = useState(remoteEnabled);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [profileForm, setProfileForm] = useState({
    displayName: fallbackProfile.user.displayName || "",
    firstName: fallbackProfile.user.firstName || "",
    lastName: fallbackProfile.user.lastName || "",
    phone: fallbackProfile.user.phone || ""
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});

  useEffect(() => {
    setProfile(fallbackProfile);
    setProfileForm({
      displayName: fallbackProfile.user.displayName || "",
      firstName: fallbackProfile.user.firstName || "",
      lastName: fallbackProfile.user.lastName || "",
      phone: fallbackProfile.user.phone || ""
    });
  }, [fallbackProfile]);

  useEffect(() => {
    let cancelled = false;
    if (!remoteEnabled) {
      setLoading(false);
      onProfileChange?.(fallbackProfile);
      return () => {
        cancelled = true;
      };
    }

    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const nextProfile = await fetchMyProfile(api);
        if (cancelled) return;
        setProfile(nextProfile);
        setProfileForm({
          displayName: nextProfile.user.displayName || "",
          firstName: nextProfile.user.firstName || "",
          lastName: nextProfile.user.lastName || "",
          phone: nextProfile.user.phone || ""
        });
        onProfileChange?.(nextProfile);
      } catch (error) {
        if (!cancelled) onError(error instanceof Error ? error.message : "Profil utilisateur indisponible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, fallbackProfile, onError, onProfileChange, remoteEnabled]);

  const account = profile.user;
  const displayName = account.displayName || account.username;
  const email = account.email || (account.username.includes("@") ? account.username : "-");
  const schoolYearLabel =
    profile.context.activeSchoolYear?.label || profile.context.activeSchoolYear?.code || "-";
  const avatarLabel = initialsFrom(displayName);

  const applyProfile = (nextProfile: UserSelfProfile): void => {
    setProfile(nextProfile);
    setProfileForm({
      displayName: nextProfile.user.displayName || "",
      firstName: nextProfile.user.firstName || "",
      lastName: nextProfile.user.lastName || "",
      phone: nextProfile.user.phone || ""
    });
    onProfileChange?.(nextProfile);
  };

  const validateProfileForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!profileForm.displayName.trim()) errors.displayName = "Nom affiché requis.";
    if (profileForm.displayName.length > 180) errors.displayName = "Nom affiché trop long.";
    if (profileForm.firstName.length > 100) errors.firstName = "Prénom trop long.";
    if (profileForm.lastName.length > 100) errors.lastName = "Nom trop long.";
    if (profileForm.phone && !/^[0-9+\s().-]{6,30}$/u.test(profileForm.phone)) {
      errors.phone = "Téléphone invalide.";
    }
    return errors;
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errors = validateProfileForm();
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSavingProfile(true);
    try {
      if (remoteEnabled) {
        const nextProfile = await updateMyProfile(api, {
          displayName: profileForm.displayName.trim(),
          firstName: profileForm.firstName.trim(),
          lastName: profileForm.lastName.trim(),
          phone: profileForm.phone.trim()
        });
        applyProfile(nextProfile);
      } else {
        applyProfile({
          ...profile,
          user: {
            ...profile.user,
            displayName: profileForm.displayName.trim(),
            firstName: profileForm.firstName.trim(),
            lastName: profileForm.lastName.trim(),
            phone: profileForm.phone.trim()
          }
        });
      }
      onNotice("Profil enregistré.");
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Profil non enregistré.");
    } finally {
      setSavingProfile(false);
    }
  };

  const validateAvatar = (file: File): string | null => {
    if (!AVATAR_MIME_TYPES.has(file.type)) return "Format d’image non autorisé. Utilisez JPG, PNG ou WebP.";
    if (file.size > AVATAR_MAX_BYTES) return "L’image doit peser 2 Mo maximum.";
    return null;
  };

  const onAvatarSelected = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const error = validateAvatar(file);
    if (error) {
      onError(error);
      return;
    }
    setUploadingAvatar(true);
    try {
      if (remoteEnabled) {
        const nextProfile = await uploadMyAvatar(api, file);
        applyProfile(nextProfile);
      } else {
        applyProfile({
          ...profile,
          user: {
            ...profile.user,
            avatarUrl: URL.createObjectURL(file)
          }
        });
      }
      onNotice("Photo de profil mise à jour.");
      onError(null);
    } catch (uploadError) {
      onError(uploadError instanceof Error ? uploadError.message : "Photo non envoyée.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onRemoveAvatar = async (): Promise<void> => {
    setRemovingAvatar(true);
    try {
      if (remoteEnabled) {
        const nextProfile = await removeMyAvatar(api);
        applyProfile(nextProfile);
      } else {
        applyProfile({
          ...profile,
          user: {
            ...profile.user,
            avatarUrl: undefined
          }
        });
      }
      onNotice("Photo de profil supprimée.");
      onError(null);
    } catch (removeError) {
      onError(removeError instanceof Error ? removeError.message : "Photo non supprimée.");
    } finally {
      setRemovingAvatar(false);
    }
  };

  const validatePasswordForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!passwordForm.currentPassword) errors.currentPassword = "Mot de passe actuel requis.";
    if (!passwordForm.newPassword) {
      errors.newPassword = "Nouveau mot de passe requis.";
    } else if (!PASSWORD_RULE.test(passwordForm.newPassword)) {
      errors.newPassword = PASSWORD_HINT;
    }
    if (passwordForm.confirmPassword !== passwordForm.newPassword) {
      errors.confirmPassword = "La confirmation ne correspond pas.";
    }
    return errors;
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errors = validatePasswordForm();
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setChangingPassword(true);
    try {
      const message = remoteEnabled
        ? await changeMyPassword(api, passwordForm)
        : "Mot de passe validé en aperçu local.";
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onNotice(message);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Mot de passe non modifié.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="profile-screen profile-screen-compact" aria-busy={loading}>
      <section className="panel profile-page-header">
        <div>
          <p className="eyebrow">{t("Compte utilisateur")}</p>
          <h2>{t("Mon profil")}</h2>
          <p>{t("Gérez vos informations personnelles et la sécurité de votre compte.")}</p>
        </div>
        <button type="button" className="button-secondary" onClick={onBackToDashboard}>
          {t("Retour tableau de bord")}
        </button>
      </section>

      <section className="panel profile-card-main">
        <div className="profile-card-avatar">
          <span className="profile-avatar-xl profile-avatar-photo">
            {account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : avatarLabel}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void onAvatarSelected(event.target.files?.[0])}
          />
          <button
            type="button"
            className="button-primary profile-avatar-button"
            disabled={uploadingAvatar}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadingAvatar ? t("Envoi de la photo...") : t("Changer la photo")}
          </button>
          {account.avatarUrl ? (
            <button
              type="button"
              className="button-secondary"
              disabled={removingAvatar}
              onClick={() => void onRemoveAvatar()}
            >
              {removingAvatar ? t("Suppression...") : t("Supprimer la photo")}
            </button>
          ) : null}
        </div>
        <div className="profile-card-identity">
          <p className="eyebrow">{t("Identité du compte")}</p>
          <h3>{displayName}</h3>
          <p className="profile-email-line" title={email}>{email}</p>
          <div className="profile-hero-meta">
            <span>{currentRoleLabel}</span>
            <span>{lookup(STATUS_LABELS, account.status)}</span>
            <span>{profile.context.tenantName}</span>
            <span>{schoolYearLabel}</span>
          </div>
        </div>
      </section>

      <section className="panel profile-tabs-panel">
        <div className="module-tabs profile-tabs" role="tablist" aria-label={t("Sections du profil")}>
          {[
            ["identity", "Informations personnelles"],
            ["security", "Sécurité"],
            ["sessions", "Sessions"]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={activeTab === id ? "active" : ""}
              onClick={() => setActiveTab(id as ProfileTab)}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {activeTab === "identity" ? (
          <div className="profile-tab-body">
            <div className="profile-details-grid compact">
              <div>
                <span>{t("Identifiant utilisateur")}</span>
                <strong className="text-ellipsis">{account.username}</strong>
              </div>
              <div>
                <span>{t("Email principal")}</span>
                <strong className="text-ellipsis">{email}</strong>
              </div>
              <div>
                <span>{t("Rôle")}</span>
                <strong>{lookup(ROLE_LABELS, account.role)}</strong>
              </div>
              <div>
                <span>{t("Type de compte")}</span>
                <strong>{lookup(ACCOUNT_TYPE_LABELS, account.accountType)}</strong>
              </div>
              <div>
                <span>{t("Date de création")}</span>
                <strong>{formatDate(account.createdAt, locale)}</strong>
              </div>
              <div>
                <span>{t("Dernière connexion")}</span>
                <strong>{t("Aucune donnée fiable disponible")}</strong>
              </div>
            </div>

            <form className="profile-form-grid compact" onSubmit={(event) => void submitProfile(event)}>
              <label>
                {t("Nom affiché")} *
                <input
                  value={profileForm.displayName}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))}
                />
                {renderError(profileErrors, "displayName")}
              </label>
              <label>
                {t("Prénom")}
                <input
                  value={profileForm.firstName}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))}
                />
                {renderError(profileErrors, "firstName")}
              </label>
              <label>
                {t("Nom")}
                <input
                  value={profileForm.lastName}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))}
                />
                {renderError(profileErrors, "lastName")}
              </label>
              <label>
                {t("Téléphone")}
                <input
                  value={profileForm.phone}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
                {renderError(profileErrors, "phone")}
              </label>
              <div className="profile-form-actions inline">
                <button type="submit" className="button-primary" disabled={savingProfile}>
                  {savingProfile ? t("Enregistrement...") : t("Enregistrer les modifications")}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() =>
                    setProfileForm({
                      displayName: account.displayName || "",
                      firstName: account.firstName || "",
                      lastName: account.lastName || "",
                      phone: account.phone || ""
                    })
                  }
                >
                  {t("Annuler")}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {activeTab === "security" ? (
          <div className="profile-tab-body">
            <div className="profile-details-grid compact">
              <div>
                <span>{t("État du compte")}</span>
                <strong>{lookup(STATUS_LABELS, account.status)}</strong>
              </div>
              <div>
                <span>{t("Première connexion")}</span>
                <strong>{account.mustChangePasswordAtFirstLogin ? t("À finaliser") : t("Terminée")}</strong>
              </div>
              <div>
                <span>{t("Dernière connexion")}</span>
                <strong>{t("Aucune donnée fiable disponible")}</strong>
              </div>
            </div>
            <form className="profile-form-grid compact" onSubmit={(event) => void submitPassword(event)}>
              {[
                ["currentPassword", "Mot de passe actuel *", "current-password"],
                ["newPassword", "Nouveau mot de passe *", "new-password"],
                ["confirmPassword", "Confirmation du nouveau mot de passe *", "new-password"]
              ].map(([key, label, autocomplete]) => (
                <label key={key} className="password-field-row">
                  {t(label)}
                  <span className="password-input-shell">
                    <input
                      aria-label={t(label)}
                      autoComplete={autocomplete}
                      type={showPasswords ? "text" : "password"}
                      value={passwordForm[key as keyof typeof passwordForm]}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="password-eye-button"
                      aria-label={showPasswords ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}
                      onClick={() => setShowPasswords((value) => !value)}
                    >
                      {showPasswords ? "✕" : "••"}
                    </button>
                  </span>
                  {renderError(passwordErrors, key)}
                </label>
              ))}
              <div className="profile-form-actions inline">
                <p className="subtle">{t(PASSWORD_HINT)}</p>
                <button type="submit" className="button-primary" disabled={changingPassword}>
                  {changingPassword ? t("Modification...") : t("Changer le mot de passe")}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {activeTab === "sessions" ? (
          <div className="profile-tab-body">
            <p className="empty-state-block">
              {t("La gestion détaillée des sessions n’est pas encore disponible.")}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
