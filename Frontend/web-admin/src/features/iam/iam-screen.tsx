import { useState, type JSX } from "react";

import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_VALUES,
  PERMISSION_ACTION_LABELS,
  PERMISSION_ACTION_VALUES,
  PERMISSION_RESOURCE_LABELS,
  PERMISSION_RESOURCE_VALUES,
  ROLE_LABELS,
  ROLE_VALUES,
  USER_STATUS_LABELS
} from "../../shared/constants/domain";
import { WorkflowGuide } from "../../shared/components/workflow-guide";
import { translateUiString, type UiLanguage } from "../../shared/i18n";
import type {
  AccountType,
  FieldErrors,
  PermissionAction,
  PermissionResource,
  Role,
  Student,
  UserAccount
} from "../../shared/types/app";
import { useIamManagement } from "./hooks/use-iam-management";
import type { IamApiClient } from "./types/iam";
import { useI18n } from "../../shared/i18n-context";

type IamScreenProps = {
  api: IamApiClient;
  initialUsers?: UserAccount[];
  students: Student[];
  remoteEnabled?: boolean;
  locale: string;
  language: UiLanguage;
  isStrongPassword?: (value: string) => boolean;
  strongPasswordHint?: string;
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
const formatUserStatusLabel = (value?: string): string => {
  const normalized = (value || "").trim().toUpperCase() as keyof typeof USER_STATUS_LABELS;
  return USER_STATUS_LABELS[normalized] || (value ? formatLookupLabel({ ACTIVE: "Actif", INACTIVE: "Inactif" }, value) : "-");
};

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

const getUserInitials = (item: UserAccount): string => {
  const source = formatUserFullName(item) !== EMPTY_VALUE_LABEL ? formatUserFullName(item) : item.username;
  const parts = source.trim().split(/\s+/u).filter(Boolean);
  const first = parts[0]?.charAt(0) || "";
  const second = parts[1]?.charAt(0) || parts[0]?.charAt(1) || "";
  return `${first}${second}`.toUpperCase() || "GS";
};

const fieldError = (
  errors: FieldErrors,
  key: string,
  translate: (source: string) => string
): JSX.Element | null =>
  errors[key] ? <span className="field-error">{translate(errors[key])}</span> : null;

export function IamScreen({
  api,
  initialUsers,
  students,
  remoteEnabled,
  locale,
  language,
  onError,
  onNotice,
  onUsersChange
}: IamScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const [openUserActionMenuId, setOpenUserActionMenuId] = useState<string | null>(null);
  const {
    accountParents,
    accountTeachers,
    compatibleUserRoles,
    deleteUserAccount,
    editingUserId,
    getEffectivePermission,
    iamSteps,
    iamWorkflowStep,
    loadRolePermissions,
    resetUserForm,
    resendUserActivation,
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
      className="module-v3-workflow"
      title={tr("Utilisateurs & droits")}
      steps={iamSteps}
      activeStepId={iamWorkflowStep}
      onStepChange={goToStep}
    >
      <div className="iam-v3-shell module-v3-shell">
        <section id="iam-accounts" data-step-id="accounts" className="panel editor-panel workflow-section module-modern iam-v3-form-card">
          <h2>{editingUserId ? tr("Modifier l'utilisateur") : tr("Créer l'utilisateur")}</h2>
          <form className="iam-account-form" onSubmit={(event) => void submitUser(event)}>
            <fieldset className="iam-form-section">
              <legend>{tr("Accès au système")}</legend>
              <div className="form-grid iam-form-grid">
                <label>
                  {tr("Identifiant ou email *")}<input
                    value={userForm.username}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, username: event.target.value }))}
                    required
                  />
                  {fieldError(userErrors, "username", tr)}
                </label>
                <label>
                  {tr("Adresse email de contact")}<input
                    type="email"
                    value={userForm.email}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </label>
                <label>
                  {tr("Téléphone")}<input
                    value={userForm.phone}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </label>
                <label>
                  {tr("Statut du compte *")}<select
                    value={userForm.status}
                    onChange={(event) =>
                      setUserForm((prev) => ({
                        ...prev,
                        status: event.target.value as typeof userForm.status,
                        isActive: event.target.value === "ACTIVE"
                      }))
                    }
                  >
                    <option value="PENDING_ACTIVATION">{tr("En attente d’activation")}</option>
                    <option value="ACTIVE">{tr("Actif")}</option>
                    <option value="INACTIVE">{tr("Inactif")}</option>
                  </select>
                </label>
                {!editingUserId ? (
                  <label className="check-row iam-check-row">
                    <input
                      type="checkbox"
                      checked={userForm.sendActivationEmail}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, sendActivationEmail: event.target.checked }))
                      }
                      disabled={userForm.status !== "PENDING_ACTIVATION"}
                    />
                    {tr("Envoyer l’email d’activation immédiatement")}</label>
                ) : null}
                <p className="iam-inline-help">
                  {tr("Le mot de passe définitif est choisi par l’utilisateur depuis le lien d’activation sécurisé.")}</p>
              </div>
            </fieldset>

            <fieldset className="iam-form-section">
              <legend>{tr("Nature du compte")}</legend>
              <div className="form-grid iam-form-grid">
                <label>
                  {tr("Type de personne")}<select
                    value={userForm.accountType}
                    onChange={(event) => setUserAccountType(event.target.value as AccountType)}
                  >
                    {ACCOUNT_TYPE_VALUES.map((accountType) => (
                      <option key={accountType} value={accountType}>{ACCOUNT_TYPE_LABELS[accountType]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr("Rôle d'accès *")}<select
                    value={userForm.roleId}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, roleId: event.target.value as Role }))}
                  >
                    {compatibleUserRoles.map((role) => (
                      <option key={role} value={role}>{tr(formatRoleLabel(role))}</option>
                    ))}
                  </select>
                  {fieldError(userErrors, "roleId", tr)}
                </label>
                <label>
                  {tr("Établissement")}<select
                    value={userForm.establishmentId}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, establishmentId: event.target.value }))}
                  >
                    <option value="">{tr("Al Manarat Islamiyat")}</option>
                  </select>
                </label>
                {userForm.accountType === "STAFF" ? (
                  <>
                    <label>
                      {tr("Fonction")}<input
                        value={userForm.staffFunction}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, staffFunction: event.target.value }))}
                      />
                    </label>
                    <label>
                      {tr("Département")}<input
                        value={userForm.department}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, department: event.target.value }))}
                      />
                    </label>
                  </>
                ) : null}
                <label className="form-grid-span-full">
                  {tr("Notes internes")}<textarea
                    rows={2}
                    value={userForm.notes}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="iam-form-section">
              <legend>{tr("Rattachement métier")}</legend>
              <div className="form-grid iam-form-grid">
                {userForm.accountType === "TEACHER" ? (
                  <label className="form-grid-span-full">
                    {tr("Fiche enseignant")}<select
                      value={userForm.teacherId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, teacherId: event.target.value }))}
                    >
                      <option value="">{tr("Choisir une fiche enseignant")}</option>
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
                    {accountTeachers.length === 0 ? <small>{tr("Créez d'abord la fiche enseignant dans le module Enseignants.")}</small> : null}
                  {fieldError(userErrors, "teacherId", tr)}
                  </label>
                ) : null}
                {userForm.accountType === "PARENT" ? (
                  <label className="form-grid-span-full">
                    {tr("Fiche parent")}<select
                      value={userForm.parentId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, parentId: event.target.value }))}
                    >
                      <option value="">{tr("Choisir une fiche parent")}</option>
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
                    {accountParents.length === 0 ? <small>{tr("Créez d'abord la fiche parent dans le module Parents.")}</small> : null}
                  {fieldError(userErrors, "parentId", tr)}
                  </label>
                ) : null}
                {userForm.accountType === "STUDENT" ? (
                  <label className="form-grid-span-full">
                    {tr("Fiche élève")}<select
                      value={userForm.studentId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, studentId: event.target.value }))}
                    >
                      <option value="">{tr("Choisir une fiche élève")}</option>
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
                    {students.length === 0 ? <small>{tr("Créez d'abord la fiche élève dans le module Élèves.")}</small> : null}
                  {fieldError(userErrors, "studentId", tr)}
                  </label>
                ) : null}
                {userForm.accountType === "STAFF" ? (
                  <label className="form-grid-span-full">
                    {tr("Nom complet *")}<input
                      value={userForm.staffDisplayName}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, staffDisplayName: event.target.value, displayName: event.target.value }))}
                    />
                  {fieldError(userErrors, "staffDisplayName", tr)}
                  </label>
                ) : null}
                {userForm.accountType !== "STAFF" ? (
                  <p className="iam-inline-help form-grid-span-full">
                    {tr("Identité synchronisée depuis le profil métier.")}</p>
                ) : null}
                  {fieldError(userErrors, "businessProfile", tr)}
              </div>
            </fieldset>

            <aside className="iam-account-summary">
              <p className="section-kicker">{tr("Résumé identité")}</p>
              <h3>{selectedBusinessDisplayName || tr("Aucune identité sélectionnée")}</h3>
              <span>{tr(formatAccountTypeLabel(userForm.accountType))} / {tr(formatRoleLabel(userForm.roleId))}</span>
              <small>{selectedBusinessEmail || tr("Email non renseigné")} - {selectedBusinessPhone || tr("Téléphone non renseigné")}</small>
              {selectedBusinessAlreadyLinked ? <strong className="danger-text">{tr("Fiche déjà rattachée à un autre compte")}</strong> : null}
              {selectedBusinessIsInactive ? <strong className="danger-text">{tr("Fiche inactive ou archivée")}</strong> : null}
            </aside>

            <div className="actions">
              <button type="submit">{editingUserId ? tr("Mettre à jour") : tr("Créer l'utilisateur")}</button>
              <button type="button" className="button-ghost" onClick={resetUserForm}>
                {editingUserId ? tr("Annuler") : tr("Réinitialiser")}
              </button>
            </div>
          </form>
        </section>

        <section data-step-id="accounts" className="panel table-panel workflow-section module-modern iam-v3-table-card">
          <div className="v3-table-head">
            <div>
              <p className="section-kicker">{tr("Accès")}</p>
              <h2>{tr("Comptes utilisateurs")}</h2>
              <p>{tr("Profils, rattachements métier et sécurité d’accès.")}</p>
            </div>
            <span className="v3-count-badge">{users.length} {tr("compte(s)")}</span>
          </div>
          <div className="table-wrap">
            <table data-responsive-table="true" data-testid="iam-users-table">
              <thead>
                <tr>
                  <th>{tr("Identifiant")}</th>
                  <th>{tr("Nom complet")}</th>
                  <th>{tr("Type de personne")}</th>
                  <th>{tr("Rôle d'accès")}</th>
                  <th>{tr("Rattachement")}</th>
                  <th>{tr("Statut")}</th>
                  <th>{tr("Dernière mise à jour")}</th>
                  <th aria-label={tr("Actions")}></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      {tr("Aucun utilisateur.")}</td>
                  </tr>
                ) : (
                  users.map((item) => (
                    <tr key={item.id}>
                      <td data-label={tr("Identifiant")}>
                        <div className="v3-table-entity-cell">
                          <span className="v3-avatar">{getUserInitials(item)}</span>
                          <div>
                            <strong>{item.username}</strong>
                            <small>{item.email || tr("Email non renseigné")}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label={tr("Nom complet")}>{formatUserFullName(item)}</td>
                      <td data-label={tr("Type de personne")}>{item.accountType ? tr(formatAccountTypeLabel(item.accountType)) : EMPTY_VALUE_LABEL}</td>
                      <td data-label={tr("Rôle d'accès")}>{tr(formatRoleLabel(item.roleId || item.role))}</td>
                      <td data-label={tr("Rattachement")}>{formatUserAttachment(item)}</td>
                      <td data-label={tr("Statut")}>
                        <span className={`status-pill ${item.status === "PENDING_ACTIVATION" ? "is-warning" : item.isActive ? "is-success" : "is-muted"}`.trim()}>
                          {formatUserStatusLabel(item.status || (item.isActive ? "ACTIVE" : "INACTIVE"))}
                        </span>
                      </td>
                      <td data-label={tr("Dernière mise à jour")}>{new Date(item.updatedAt).toLocaleString(locale)}</td>
                      <td data-label={tr("Actions")}>
                        <div className="v3-action-cell">
                          <button
                            type="button"
                            className="v3-more-button"
                            aria-label={`Actions ${item.username}`}
                            aria-expanded={openUserActionMenuId === item.id}
                            onClick={() => setOpenUserActionMenuId((current) => (current === item.id ? null : item.id))}
                          >
                            <span aria-hidden="true">...</span>
                          </button>
                          {openUserActionMenuId === item.id ? (
                            <div className="v3-action-menu" role="menu">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenUserActionMenuId(null);
                                  startEditUser(item);
                                }}
                              >
                                {tr("Modifier")}</button>
                              {item.status === "PENDING_ACTIVATION" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenUserActionMenuId(null);
                                    void resendUserActivation(item);
                                  }}
                                >
                                  {tr("Renvoyer l’activation")}</button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenUserActionMenuId(null);
                                  void toggleUserAccountStatus(item, !item.isActive);
                                }}
                              >
                                {item.isActive ? tr("Désactiver") : tr("Réactiver")}
                              </button>
                              <button
                                type="button"
                                className="is-danger"
                                onClick={() => {
                                  setOpenUserActionMenuId(null);
                                  void deleteUserAccount(item.id);
                                }}
                              >
                                {tr("Supprimer")}</button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="iam-permissions" data-step-id="permissions" className="panel table-panel workflow-section module-modern iam-permissions-panel">
          <div className="table-header iam-permissions-header">
            <h2>{tr("Droits par profil")}</h2>
            <div className="inline-actions iam-permissions-actions">
              <label className="iam-permissions-target">
                {tr("Profil à configurer")}<select
                  value={rolePermissionTarget}
                  onChange={(event) => {
                    const nextRole = event.target.value as Role;
                    setRolePermissionTarget(nextRole);
                    void loadRolePermissions(nextRole);
                  }}
                >
                  {ROLE_VALUES.map((role) => (
                    <option key={role} value={role}>
                      {tr(formatRoleLabel(role))}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="button-ghost" onClick={() => void loadRolePermissions(rolePermissionTarget)}>
                {tr("Recharger")}</button>
              <button type="button" onClick={() => void saveCurrentRolePermissions()}>
                {tr("Enregistrer les droits")}</button>
            </div>
          </div>
          <p className="subtle">
            {tr("Sélectionnez les actions autorisées pour chaque ressource.")}</p>
          <div className="table-wrap iam-permissions-wrap">
            <table className="iam-permissions-table" data-responsive-table="true" data-testid="iam-permissions-table">
              <thead>
                <tr>
                  <th>{tr("Ressource")}</th>
                  {PERMISSION_ACTION_VALUES.map((action) => (
                    <th key={action}>{tr(formatPermissionActionLabel(action))}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_RESOURCE_VALUES.map((resource) => (
                  <tr key={resource}>
                    <td data-label={tr("Ressource")}>{tr(formatPermissionResourceLabel(resource))}</td>
                    {PERMISSION_ACTION_VALUES.map((action) => (
                      <td data-label={tr(formatPermissionActionLabel(action))} key={`${resource}:${action}`}>
                        <input
                          type="checkbox"
                          aria-label={`${tr(formatPermissionResourceLabel(resource))} - ${tr(formatPermissionActionLabel(action))}`}
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
      </div>
    </WorkflowGuide>
  );
}
