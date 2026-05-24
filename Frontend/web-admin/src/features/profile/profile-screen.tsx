import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { translateUiString, type UiLanguage } from "../../shared/i18n";
import type {
  FieldErrors,
  SchoolYear,
  Session,
  ThemeMode,
  UserAccount,
  UserActivityItem,
  UserSelfProfile
} from "../../shared/types/app";
import {
  changeMyPassword,
  fetchMyActivity,
  fetchMyProfile,
  removeMyAvatar,
  type ProfileApiClient,
  updateMyProfile,
  uploadMyAvatar
} from "./profile-service";
import {
  ProfilePage,
  type PasswordFieldKey,
  type PasswordFormState,
  type PreferenceFormState,
  type PremiumActivityItem,
  type ProfileFormState,
  type ProfileInfoRow
} from "./ProfilePage";

type ProfileScreenProps = {
  api: ProfileApiClient;
  currentRoleLabel: string;
  locale: string;
  onError: (message: string | null) => void;
  onLanguageChange?: (language: UiLanguage) => void;
  onNotice: (message: string | null) => void;
  onProfileChange?: (profile: UserSelfProfile) => void;
  onThemeChange?: (theme: ThemeMode) => void;
  remoteEnabled?: boolean;
  schoolName: string;
  schoolYears: SchoolYear[];
  session: Session;
  themeMode: ThemeMode;
  uiLanguage: UiLanguage;
  users: UserAccount[];
};

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
  return date.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
};

const formatDateTime = (value: string | undefined, locale: string): string => {
  if (!value) return "Aucune connexion enregistrée";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Aucune connexion enregistrée";
  return date.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const formatActivityTime = (value: string | undefined, locale: string): string => {
  if (!value) return "Aucune date disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Aucune date disponible";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const emptyLabel = (value?: string): string => value?.trim() || "À renseigner";

const buildFallbackProfile = (
  session: Session,
  users: UserAccount[],
  schoolYears: SchoolYear[],
  schoolName: string,
  uiLanguage: UiLanguage,
  themeMode: ThemeMode
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
    preferences: {
      language: uiLanguage,
      theme: themeMode,
      emailNotificationsEnabled: true,
      systemNotificationsEnabled: true
    },
    permissions: []
  };
};

const profileFormFrom = (profile: UserSelfProfile): ProfileFormState => ({
  displayName: profile.user.displayName || profile.user.username || "",
  firstName: profile.user.firstName || "",
  lastName: profile.user.lastName || "",
  phone: profile.user.phone || ""
});

const preferencesFrom = (
  profile: UserSelfProfile,
  uiLanguage: UiLanguage,
  themeMode: ThemeMode
): PreferenceFormState => ({
  language: (profile.preferences?.language as UiLanguage | undefined) || uiLanguage,
  theme: (profile.preferences?.theme as ThemeMode | undefined) || themeMode,
  timeZone: profile.context.timeZone || "Europe/Paris",
  emailNotificationsEnabled: profile.preferences?.emailNotificationsEnabled ?? true,
  pushNotificationsEnabled: profile.preferences?.systemNotificationsEnabled ?? true
});

const buildFullName = (account: UserAccount): string => {
  const names = [account.firstName, account.lastName].map((item) => item?.trim()).filter(Boolean);
  return names.join(" ") || account.displayName || account.username;
};

const mapActivity = (item: UserActivityItem, locale: string): PremiumActivityItem => {
  const action = `${item.action} ${item.resource}`.toLowerCase();
  if (action.includes("password")) {
    return { id: item.id, icon: "lock", tone: "purple", title: "Mot de passe modifié", time: formatActivityTime(item.createdAt, locale) };
  }
  if (action.includes("profile") || action.includes("avatar")) {
    return { id: item.id, icon: "edit", tone: "blue", title: "Modification du profil", time: formatActivityTime(item.createdAt, locale) };
  }
  if (action.includes("login") || action.includes("auth")) {
    return { id: item.id, icon: "shield", tone: "green", title: "Connexion réussie", time: formatActivityTime(item.createdAt, locale) };
  }
  return { id: item.id, icon: "activity", tone: "orange", title: item.action, time: formatActivityTime(item.createdAt, locale) };
};

const buildDefaultActivity = (account: UserAccount, locale: string): PremiumActivityItem[] => [
  {
    id: "last-login",
    icon: "shield",
    tone: "green",
    title: "Connexion réussie",
    time: account.lastLoginAt ? formatActivityTime(account.lastLoginAt, locale) : "Aujourd’hui à 09:42"
  },
  {
    id: "profile-update",
    icon: "edit",
    tone: "blue",
    title: "Modification du profil",
    time: account.updatedAt ? formatActivityTime(account.updatedAt, locale) : "Hier à 16:30"
  },
  { id: "class-created", icon: "school", tone: "orange", title: "Création d’une classe", time: "14 mai à 11:20" },
  { id: "student-added", icon: "student", tone: "green", title: "Ajout d’un élève", time: "13 mai à 15:45" },
  { id: "grades-export", icon: "export", tone: "purple", title: "Export des notes", time: "12 mai à 10:15" }
];

export function ProfileScreen({
  api,
  currentRoleLabel,
  locale,
  onError,
  onLanguageChange,
  onNotice,
  onProfileChange,
  onThemeChange,
  remoteEnabled = true,
  schoolName,
  schoolYears,
  session,
  themeMode,
  uiLanguage,
  users
}: ProfileScreenProps): JSX.Element {
  const t = (value: string): string => translateUiString(uiLanguage, value);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackProfile = useMemo(
    () => buildFallbackProfile(session, users, schoolYears, schoolName, uiLanguage, themeMode),
    [schoolName, schoolYears, session, themeMode, uiLanguage, users]
  );
  const [profile, setProfile] = useState<UserSelfProfile>(fallbackProfile);
  const [loading, setLoading] = useState(remoteEnabled);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const [visiblePasswordFields, setVisiblePasswordFields] = useState<Record<PasswordFieldKey, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [profileForm, setProfileForm] = useState<ProfileFormState>(profileFormFrom(fallbackProfile));
  const [preferencesForm, setPreferencesForm] = useState<PreferenceFormState>(
    preferencesFrom(fallbackProfile, uiLanguage, themeMode)
  );
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
  const [activityRows, setActivityRows] = useState<UserActivityItem[]>([]);

  useEffect(() => {
    setProfile(fallbackProfile);
    setProfileForm(profileFormFrom(fallbackProfile));
    setPreferencesForm(preferencesFrom(fallbackProfile, uiLanguage, themeMode));
  }, [fallbackProfile, themeMode, uiLanguage]);

  useEffect(() => {
    let cancelled = false;
    if (!remoteEnabled) {
      setLoading(false);
      setActivityRows([]);
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
        setProfileForm(profileFormFrom(nextProfile));
        setPreferencesForm(preferencesFrom(nextProfile, uiLanguage, themeMode));
        onProfileChange?.(nextProfile);
        fetchMyActivity(api)
          .then((items) => {
            if (!cancelled) setActivityRows(items);
          })
          .catch(() => undefined);
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
  }, [api, fallbackProfile, onError, onProfileChange, remoteEnabled, themeMode, uiLanguage]);

  const account = profile.user;
  const fullName = buildFullName(account);
  const email = account.email || (account.username.includes("@") ? account.username : "-");
  const schoolYearLabel =
    profile.context.activeSchoolYear?.label || profile.context.activeSchoolYear?.code || "-";
  const avatarInitials = initialsFrom(fullName);
  const createdAtLabel = formatDate(account.createdAt, locale);
  const lastLoginLabel = formatDateTime(account.lastLoginAt, locale);
  const accountTypeLabel = lookup(ACCOUNT_TYPE_LABELS, account.accountType);
  const statusLabel = lookup(STATUS_LABELS, account.status);
  const activityItems = useMemo(() => {
    const mapped = activityRows.map((item) => mapActivity(item, locale));
    return remoteEnabled ? mapped.slice(0, 5) : [...mapped, ...buildDefaultActivity(account, locale)].slice(0, 5);
  }, [account, activityRows, locale, remoteEnabled]);
  const personalInfoRows: ProfileInfoRow[] = [
    { label: "Nom complet", value: fullName },
    { label: "Date de naissance", value: "À renseigner" },
    { label: "Adresse", value: "À renseigner" },
    { label: "Sexe", value: "À renseigner" },
    { label: "Nationalité", value: "À renseigner" },
    { label: "Téléphone", value: emptyLabel(account.phone) }
  ];
  const bio =
    account.notes?.trim() ||
    `J’accompagne l’équipe ${schoolName} dans le suivi administratif, la sécurité des accès et la qualité des données scolaires.`;

  const applyProfile = (nextProfile: UserSelfProfile): void => {
    setProfile(nextProfile);
    setProfileForm(profileFormFrom(nextProfile));
    setPreferencesForm(preferencesFrom(nextProfile, uiLanguage, themeMode));
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
            phone: profileForm.phone.trim(),
            updatedAt: new Date().toISOString()
          }
        });
      }
      setIsEditingProfile(false);
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
      if (avatarInputRef.current) avatarInputRef.current.value = "";
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
      setVisiblePasswordFields({ currentPassword: false, newPassword: false, confirmPassword: false });
      setPasswordPanelOpen(false);
      onNotice(message);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Mot de passe non modifié.");
    } finally {
      setChangingPassword(false);
    }
  };

  const submitPreferences = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSavingPreferences(true);
    try {
      if (remoteEnabled) {
        const nextProfile = await updateMyProfile(api, {
          displayName: account.displayName || account.username,
          phone: account.phone || "",
          language: preferencesForm.language,
          theme: preferencesForm.theme,
          emailNotificationsEnabled: preferencesForm.emailNotificationsEnabled,
          systemNotificationsEnabled: preferencesForm.pushNotificationsEnabled
        });
        applyProfile(nextProfile);
      } else {
        setProfile((previous) => ({
          ...previous,
          preferences: {
            language: preferencesForm.language,
            theme: preferencesForm.theme,
            emailNotificationsEnabled: preferencesForm.emailNotificationsEnabled,
            systemNotificationsEnabled: preferencesForm.pushNotificationsEnabled
          }
        }));
      }
      onLanguageChange?.(preferencesForm.language);
      onThemeChange?.(preferencesForm.theme);
      onNotice("Préférences enregistrées.");
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Préférences non enregistrées.");
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <ProfilePage
      accountTypeLabel={accountTypeLabel}
      activityItems={activityItems}
      avatarInputRef={avatarInputRef}
      avatarInitials={avatarInitials}
      avatarUrl={account.avatarUrl}
      bio={bio}
      changingPassword={changingPassword}
      createdAtLabel={createdAtLabel}
      currentRoleLabel={currentRoleLabel}
      email={email}
      fullName={fullName}
      isEditingProfile={isEditingProfile}
      lastLoginLabel={lastLoginLabel}
      loading={loading}
      onAvatarFileSelected={(file) => void onAvatarSelected(file)}
      onCancelProfileEdit={() => {
        setProfileForm(profileFormFrom(profile));
        setProfileErrors({});
        setIsEditingProfile(false);
      }}
      onChangePasswordField={(key, value) => setPasswordForm((previous) => ({ ...previous, [key]: value }))}
      onLogoutAllDevices={() => onNotice("La gestion détaillée des sessions sera disponible dans l’espace sécurité.")}
      onOpenAvatarPicker={() => avatarInputRef.current?.click()}
      onOpenPasswordEditor={() => setPasswordPanelOpen((previous) => !previous)}
      onOpenProfileEditor={() => setIsEditingProfile(true)}
      onPreferenceChange={(key, value) => setPreferencesForm((previous) => ({ ...previous, [key]: value }))}
      onProfileFieldChange={(key, value) => setProfileForm((previous) => ({ ...previous, [key]: value }))}
      onRemoveAvatar={() => void onRemoveAvatar()}
      onSubmitPassword={(event) => void submitPassword(event)}
      onSubmitPreferences={(event) => void submitPreferences(event)}
      onSubmitProfile={(event) => void submitProfile(event)}
      onTogglePasswordVisibility={(key) =>
        setVisiblePasswordFields((previous) => ({ ...previous, [key]: !previous[key] }))
      }
      onViewSessions={() => onNotice("La gestion détaillée des sessions n’est pas encore disponible.")}
      onViewPermissions={() => onNotice("Les permissions détaillées restent gérées dans Utilisateurs & droits.")}
      passwordErrors={passwordErrors}
      passwordForm={passwordForm}
      passwordPanelOpen={passwordPanelOpen}
      personalInfoRows={personalInfoRows}
      preferencesForm={preferencesForm}
      profile={profile}
      profileErrors={profileErrors}
      profileForm={profileForm}
      removingAvatar={removingAvatar}
      savingPreferences={savingPreferences}
      savingProfile={savingProfile}
      schoolName={schoolName}
      schoolYearLabel={schoolYearLabel}
      security={{
        twoFactorEnabled: !remoteEnabled,
        twoFactorLabel: remoteEnabled ? "Non configurée" : "Activée",
        activeSessionsLabel: remoteEnabled ? "Non disponible" : "2 appareils"
      }}
      statusLabel={statusLabel}
      t={t}
      uploadingAvatar={uploadingAvatar}
      visiblePasswordFields={visiblePasswordFields}
    />
  );
}
