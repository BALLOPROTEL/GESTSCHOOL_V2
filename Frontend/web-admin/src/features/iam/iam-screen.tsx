import type { JSX } from "react";

import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_VALUES,
  PASSWORD_MODE_LABELS,
  PERMISSION_ACTION_LABELS,
  PERMISSION_ACTION_VALUES,
  PERMISSION_RESOURCE_LABELS,
  PERMISSION_RESOURCE_VALUES,
  ROLE_LABELS,
  ROLE_VALUES
} from "../../shared/constants/domain";
import { WorkflowGuide } from "../../shared/components/workflow-guide";
import { translateUiString, type UiLanguage } from "../../shared/i18n";
import type {
  AccountType,
  FieldErrors,
  PasswordMode,
  PermissionAction,
  PermissionResource,
  Role,
  Student,
  UserAccount
} from "../../shared/types/app";
import { useIamManagement } from "./hooks/use-iam-management";
import type { IamApiClient } from "./types/iam";

type IamScreenProps = {
  api: IamApiClient;
  initialUsers?: UserAccount[];
  students: Student[];
  remoteEnabled?: boolean;
  locale: string;
  language: UiLanguage;
  isStrongPassword: (value: string) => boolean;
  strongPasswordHint: string;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  onUsersChange?: (users: UserAccount[]) => void;
};

const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};

const formatRoleLabel = (value?: string): string => formatLookupLabel(ROLE_LABELS, value);
const formatAccountTypeLabel = (value?: string): string => formatLookupLabel(ACCOUNT_TYPE_LABELS, value);
const formatPermissionActionLabel = (value: PermissionAction): string =>
  PERMISSION_ACTION_LABELS[value] || value;
const formatPermissionResourceLabel = (value: PermissionResource): string =>
  PERMISSION_RESOURCE_LABELS[value] || value;

const EMPTY_VALUE_LABEL = "Non renseigné";

const formatUserFullName = (item: UserAccount): string => {
  const fromDisplayName = (item.displayName || "").trim();
  if (fromDisplayName) return fromDisplayName;
  const fromParts = [item.firstName, item.lastName].filter(Boolean).join(" ").trim();
  return fromParts || EMPTY_VALUE_LABEL;
};

const formatUserAttachment = (item: UserAccount): string => {
  if (item.teacherId) return "Fiche enseignant";
  if (item.parentId) return "Fiche parent";
  if (item.studentId) return "Fiche élève";
  if (item.staffFunction || item.department) {
    return [item.staffFunction, item.department].filter(Boolean).join(" - ");
  }
  return "Staff interne";
};

const fieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? <span className="field-error">{errors[key]}</span> : null;

export function IamScreen({
  api,
  initialUsers,
  students,
  remoteEnabled,
  locale,
  language,
  isStrongPassword,
  strongPasswordHint,
  onError,
  onNotice,
  onUsersChange
}: IamScreenProps): JSX.Element {
  const {
    accountParents,
    accountTeachers,
    compatibleUserRoles,
    deleteUserAccount,
    editingUserId,
    getEffectivePermission,
    iamSteps,
    iamWorkflowStep,
    lastTemporaryPassword,
    loadRolePermissions,
    resetUserForm,
    rolePermissionTarget,
    saveCurrentRolePermissions,
    selectedBusinessAlreadyLinked,
    selectedBusinessDisplayName,
    selectedBusinessEmail,
    selectedBusinessIsInactive,
    selectedBusinessPhone,
    setIamWorkflowStep,
    setRolePermissionTarget,
    setUserAccountType,
    setUserForm,
    startEditUser,
    submitUser,
    toggleUserAccountStatus,
    toggleRolePermission,
    userErrors,
    userForm,
    users
  } = useIamManagement({
    api,
    initialUsers,
    students,
    remoteEnabled,
    isStrongPassword,
    strongPasswordHint,
    onError,
    onNotice,
    onUsersChange,
    translate: (source) => translateUiString(language, source)
  });

  const goToStep = (stepId: string): void => {
    setIamWorkflowStep(stepId);
    const targetByStep: Record<string, string> = {
      accounts: "iam-accounts",
      permissions: "iam-permissions"
    };
    const target = targetByStep[stepId];
    if (!target) return;
    window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  return (
    <WorkflowGuide
      title="Utilisateurs & droits"
      steps={iamSteps}
      activeStepId={iamWorkflowStep}
      onStepChange={goToStep}
    >
      <>
        <section id="iam-accounts" data-step-id="accounts" className="panel editor-panel workflow-section">
          <h2>{editingUserId ? "Modifier l'utilisateur" : "Créer l'utilisateur"}</h2>
          {lastTemporaryPassword ? (
            <div className="notice-card notice-success" role="status">
              <strong>Mot de passe temporaire généré</strong>
              <p>Communiquez-le une seule fois à l'utilisateur, puis le compte devra changer son mot de passe à la première connexion.</p>
              <code>{lastTemporaryPassword}</code>
            </div>
          ) : null}
          <form className="iam-account-form" onSubmit={(event) => void submitUser(event)}>
            <fieldset className="iam-form-section">
              <legend>Accès au système</legend>
              <div className="form-grid iam-form-grid">
                <label>
                  Identifiant ou email *
                  <input
                    value={userForm.username}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, username: event.target.value }))}
                    required
                  />
                  {fieldError(userErrors, "username")}
                </label>
                <label>
                  Adresse email de contact
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </label>
                <label>
                  Téléphone
                  <input
                    value={userForm.phone}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </label>
                <label>
                  Mode mot de passe *
                  <select
                    value={userForm.passwordMode}
                    onChange={(event) =>
                      setUserForm((prev) => ({ ...prev, passwordMode: event.target.value as PasswordMode, password: "", confirmPassword: "" }))
                    }
                    disabled={Boolean(editingUserId)}
                  >
                    {(["AUTO", "MANUAL"] as PasswordMode[]).map((mode) => (
                      <option key={mode} value={mode}>{PASSWORD_MODE_LABELS[mode]}</option>
                    ))}
                  </select>
                </label>
                {userForm.passwordMode === "MANUAL" ? (
                  <>
                    <label>
                      Mot de passe {editingUserId ? "(laisser vide pour conserver)" : ""}
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                        minLength={12}
                      />
                      {fieldError(userErrors, "password")}
                    </label>
                    <label>
                      Confirmation
                      <input
                        type="password"
                        value={userForm.confirmPassword}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      />
                      {fieldError(userErrors, "confirmPassword")}
                    </label>
                  </>
                ) : (
                  <p className="iam-inline-help">
                    Un mot de passe temporaire fort sera généré et le changement à la première connexion restera actif.
                  </p>
                )}
                <label className="check-row iam-check-row">
                  <input
                    type="checkbox"
                    checked={userForm.mustChangePasswordAtFirstLogin}
                    onChange={(event) =>
                      setUserForm((prev) => ({ ...prev, mustChangePasswordAtFirstLogin: event.target.checked }))
                    }
                  />
                  Changement obligatoire à la première connexion
                </label>
                <label>
                  Statut du compte *
                  <select
                    value={userForm.isActive ? "ACTIVE" : "INACTIVE"}
                    onChange={(event) =>
                      setUserForm((prev) => ({ ...prev, isActive: event.target.value === "ACTIVE" }))
                    }
                  >
                    <option value="ACTIVE">Actif</option>
                    <option value="INACTIVE">Inactif</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset className="iam-form-section">
              <legend>Nature du compte</legend>
              <div className="form-grid iam-form-grid">
                <label>
                  Type de personne
                  <select
                    value={userForm.accountType}
                    onChange={(event) => setUserAccountType(event.target.value as AccountType)}
                  >
                    {ACCOUNT_TYPE_VALUES.map((accountType) => (
                      <option key={accountType} value={accountType}>{ACCOUNT_TYPE_LABELS[accountType]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Rôle d'accès *
                  <select
                    value={userForm.roleId}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, roleId: event.target.value as Role }))}
                  >
                    {compatibleUserRoles.map((role) => (
                      <option key={role} value={role}>{formatRoleLabel(role)}</option>
                    ))}
                  </select>
                  {fieldError(userErrors, "roleId")}
                </label>
                <label>
                  Établissement
                  <select
                    value={userForm.establishmentId}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, establishmentId: event.target.value }))}
                  >
                    <option value="">Al Manarat Islamiyat</option>
                  </select>
                </label>
                {userForm.accountType === "STAFF" ? (
                  <>
                    <label>
                      Fonction
                      <input
                        value={userForm.staffFunction}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, staffFunction: event.target.value }))}
                      />
                    </label>
                    <label>
                      Département
                      <input
                        value={userForm.department}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, department: event.target.value }))}
                      />
                    </label>
                  </>
                ) : null}
                <label className="form-grid-span-full">
                  Notes internes
                  <textarea
                    rows={2}
                    value={userForm.notes}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="iam-form-section">
              <legend>Rattachement métier</legend>
              <div className="form-grid iam-form-grid">
                {userForm.accountType === "TEACHER" ? (
                  <label className="form-grid-span-full">
                    Fiche enseignant
                    <select
                      value={userForm.teacherId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, teacherId: event.target.value }))}
                    >
                      <option value="">Choisir une fiche enseignant</option>
                      {accountTeachers.map((teacher) => (
                        <option
                          key={teacher.id}
                          value={teacher.id}
                          disabled={Boolean((teacher.userId && teacher.userId !== editingUserId) || teacher.status !== "ACTIVE" || teacher.archivedAt)}
                        >
                          {teacher.matricule} - {teacher.fullName}{teacher.userId && teacher.userId !== editingUserId ? " (déjà lié)" : ""}{teacher.status !== "ACTIVE" ? ` (${teacher.status})` : ""}
                        </option>
                      ))}
                    </select>
                    {accountTeachers.length === 0 ? <small>Créez d'abord la fiche enseignant dans le module Enseignants.</small> : null}
                    {fieldError(userErrors, "teacherId")}
                  </label>
                ) : null}
                {userForm.accountType === "PARENT" ? (
                  <label className="form-grid-span-full">
                    Fiche parent
                    <select
                      value={userForm.parentId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, parentId: event.target.value }))}
                    >
                      <option value="">Choisir une fiche parent</option>
                      {accountParents.map((parent) => (
                        <option
                          key={parent.id}
                          value={parent.id}
                          disabled={Boolean((parent.userId && parent.userId !== editingUserId) || parent.status !== "ACTIVE" || parent.archivedAt)}
                        >
                          {parent.fullName} - {parent.primaryPhone}{parent.userId && parent.userId !== editingUserId ? " (déjà lié)" : ""}{parent.status !== "ACTIVE" ? ` (${parent.status})` : ""}
                        </option>
                      ))}
                    </select>
                    {accountParents.length === 0 ? <small>Créez d'abord la fiche parent dans le module Parents.</small> : null}
                    {fieldError(userErrors, "parentId")}
                  </label>
                ) : null}
                {userForm.accountType === "STUDENT" ? (
                  <label className="form-grid-span-full">
                    Fiche élève
                    <select
                      value={userForm.studentId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, studentId: event.target.value }))}
                    >
                      <option value="">Choisir une fiche élève</option>
                      {students.map((student) => (
                        <option
                          key={student.id}
                          value={student.id}
                          disabled={Boolean((student.userId && student.userId !== editingUserId) || student.status !== "ACTIVE" || student.archivedAt)}
                        >
                          {student.matricule} - {student.fullName || `${student.firstName} ${student.lastName}`}{student.userId && student.userId !== editingUserId ? " (déjà lié)" : ""}{student.status && student.status !== "ACTIVE" ? ` (${student.status})` : ""}
                        </option>
                      ))}
                    </select>
                    {students.length === 0 ? <small>Créez d'abord la fiche élève dans le module Élèves.</small> : null}
                    {fieldError(userErrors, "studentId")}
                  </label>
                ) : null}
                {userForm.accountType === "STAFF" ? (
                  <label className="form-grid-span-full">
                    Nom complet *
                    <input
                      value={userForm.staffDisplayName}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, staffDisplayName: event.target.value, displayName: event.target.value }))}
                    />
                    {fieldError(userErrors, "staffDisplayName")}
                  </label>
                ) : null}
                {userForm.accountType !== "STAFF" ? (
                  <p className="iam-inline-help form-grid-span-full">
                    Identité synchronisée depuis le profil métier.
                  </p>
                ) : null}
                {fieldError(userErrors, "businessProfile")}
              </div>
            </fieldset>

            <aside className="iam-account-summary">
              <p className="section-kicker">Résumé identité</p>
              <h3>{selectedBusinessDisplayName || "Aucune identité sélectionnée"}</h3>
              <span>{formatAccountTypeLabel(userForm.accountType)} / {formatRoleLabel(userForm.roleId)}</span>
              <small>{selectedBusinessEmail || "Email non renseigné"} - {selectedBusinessPhone || "Téléphone non renseigné"}</small>
              {selectedBusinessAlreadyLinked ? <strong className="danger-text">Fiche déjà rattachée à un autre compte</strong> : null}
              {selectedBusinessIsInactive ? <strong className="danger-text">Fiche inactive ou archivée</strong> : null}
            </aside>

            <div className="actions">
              <button type="submit">{editingUserId ? "Mettre à jour" : "Créer l'utilisateur"}</button>
              <button type="button" className="button-ghost" onClick={resetUserForm}>
                {editingUserId ? "Annuler" : "Réinitialiser"}
              </button>
            </div>
          </form>
        </section>

        <section data-step-id="accounts" className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Comptes utilisateurs</h2>
          </div>
          <div className="table-wrap">
            <table data-responsive-table="true" data-testid="iam-users-table">
              <thead>
                <tr>
                  <th>Identifiant</th>
                  <th>Nom complet</th>
                  <th>Type de personne</th>
                  <th>Rôle d'accès</th>
                  <th>Rattachement</th>
                  <th>Statut</th>
                  <th>Dernière mise à jour</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      Aucun utilisateur.
                    </td>
                  </tr>
                ) : (
                  users.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Identifiant">{item.username}</td>
                      <td data-label="Nom complet">{formatUserFullName(item)}</td>
                      <td data-label="Type de personne">{item.accountType ? formatAccountTypeLabel(item.accountType) : EMPTY_VALUE_LABEL}</td>
                      <td data-label="Rôle d'accès">{formatRoleLabel(item.roleId || item.role)}</td>
                      <td data-label="Rattachement">{formatUserAttachment(item)}</td>
                      <td data-label="Statut">
                        <span className={`status-pill ${item.isActive ? "is-success" : "is-muted"}`.trim()}>
                          {item.isActive ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td data-label="Dernière mise à jour">{new Date(item.updatedAt).toLocaleString(locale)}</td>
                      <td data-label="Actions">
                        <div className="table-actions iam-user-actions">
                          <button type="button" className="button-ghost" onClick={() => startEditUser(item)}>
                            Modifier
                          </button>
                          <button type="button" className="button-ghost" onClick={() => void toggleUserAccountStatus(item, !item.isActive)}>
                            {item.isActive ? "Désactiver" : "Réactiver"}
                          </button>
                          <button type="button" className="button-danger" onClick={() => void deleteUserAccount(item.id)}>
                            Supprimer
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

        <section id="iam-permissions" data-step-id="permissions" className="panel table-panel workflow-section iam-permissions-panel">
          <div className="table-header iam-permissions-header">
            <h2>Droits par profil</h2>
            <div className="inline-actions iam-permissions-actions">
              <label className="iam-permissions-target">
                Profil à configurer
                <select
                  value={rolePermissionTarget}
                  onChange={(event) => {
                    const nextRole = event.target.value as Role;
                    setRolePermissionTarget(nextRole);
                    void loadRolePermissions(nextRole);
                  }}
                >
                  {ROLE_VALUES.map((role) => (
                    <option key={role} value={role}>
                      {formatRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="button-ghost" onClick={() => void loadRolePermissions(rolePermissionTarget)}>
                Recharger
              </button>
              <button type="button" onClick={() => void saveCurrentRolePermissions()}>
                Enregistrer les droits
              </button>
            </div>
          </div>
          <p className="subtle">
            Sélectionnez les actions autorisées pour chaque ressource.
          </p>
          <div className="table-wrap iam-permissions-wrap">
            <table className="iam-permissions-table" data-testid="iam-permissions-table">
              <thead>
                <tr>
                  <th>Ressource</th>
                  {PERMISSION_ACTION_VALUES.map((action) => (
                    <th key={action}>{formatPermissionActionLabel(action)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_RESOURCE_VALUES.map((resource) => (
                  <tr key={resource}>
                    <td>{formatPermissionResourceLabel(resource)}</td>
                    {PERMISSION_ACTION_VALUES.map((action) => (
                      <td key={`${resource}:${action}`}>
                        <input
                          type="checkbox"
                          aria-label={`${formatPermissionResourceLabel(resource)} - ${formatPermissionActionLabel(action)}`}
                          checked={getEffectivePermission(resource, action)}
                          onChange={(event) =>
                            toggleRolePermission(resource, action, event.target.checked)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    </WorkflowGuide>
  );
}
