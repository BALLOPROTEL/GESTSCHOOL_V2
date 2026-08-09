import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  ACCOUNT_TYPE_ROLE_OPTIONS,
  PERMISSION_ACTION_VALUES,
  PERMISSION_RESOURCE_VALUES,
  ROLE_LABELS
} from "../../../shared/constants/domain";
import { UI_MESSAGES } from "../../../shared/i18n";
import { toUiErrorMessage } from "../../../shared/services/api-errors";
import { useConfirmDialog } from "../../../shared/components/confirm-dialog";
import type {
  AccountType,
  FieldErrors,
  ParentRecord,
  PermissionAction,
  PermissionResource,
  Role,
  RolePermissionView,
  Student,
  TeacherRecord,
  UserAccount
} from "../../../shared/types/app";
import {
  fetchIamAccountReferences,
  fetchIamUsers,
  fetchRolePermissions,
  removeIamUser,
  saveRolePermissions,
  sendIamUserActivation,
  upsertIamUser
} from "../services/iam-service";
import type { IamApiClient, IamUserForm } from "../types/iam";

type UseIamManagementOptions = {
  api: IamApiClient;
  initialUsers?: UserAccount[];
  students: Student[];
  remoteEnabled?: boolean;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  onUsersChange?: (users: UserAccount[]) => void;
  translate?: (source: string) => string;
};

const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

const formatRoleLabel = (value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return ROLE_LABELS[normalized as Role] || value || "-";
};

const focusFirstInlineErrorField = (stepId?: string): void => {
  window.setTimeout(() => {
    const scope = stepId
      ? document.querySelector(`[data-step-id="${stepId}"][data-active-step="true"]`)
      : document;

    if (!scope) return;
    const errorNode = scope.querySelector(".field-error");
    if (!errorNode) return;

    const label = errorNode.closest("label");
    const input = label?.querySelector<HTMLElement>("input, select, textarea");
    if (!input) return;

    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 0);
};

const buildDefaultUserForm = (): IamUserForm => ({
  username: "",
  email: "",
  phone: "",
  passwordMode: "AUTO",
  password: "",
  confirmPassword: "",
  accountType: "STAFF",
  roleId: "SCOLARITE",
  teacherId: "",
  parentId: "",
  studentId: "",
  autoFillIdentity: true,
  staffDisplayName: "",
  staffFunction: "",
  department: "",
  displayName: "",
  establishmentId: "",
  notes: "",
  mustChangePasswordAtFirstLogin: true,
  status: "PENDING_ACTIVATION",
  sendActivationEmail: true,
  isActive: false
});

const PREVIEW_ROLE_PERMISSIONS: RolePermissionView[] = [
  { role: "ADMIN", resource: "students", action: "read", allowed: true, source: "CUSTOM" },
  { role: "ADMIN", resource: "finance", action: "read", allowed: true, source: "CUSTOM" },
  { role: "ADMIN", resource: "grades", action: "read", allowed: true, source: "CUSTOM" },
  { role: "ADMIN", resource: "audit", action: "read", allowed: true, source: "CUSTOM" }
];

const getIdentityDisplayName = (
  identity: TeacherRecord | ParentRecord | Student | null,
  fallback: string
): string => {
  if (!identity) return fallback;
  if ("fullName" in identity && identity.fullName) return identity.fullName;
  return `${identity.firstName} ${identity.lastName}`.trim();
};

const getIdentityEmail = (
  identity: TeacherRecord | ParentRecord | Student | null,
  fallback: string
): string => {
  return identity && "email" in identity && identity.email ? identity.email : fallback;
};

const getIdentityPhone = (
  identity: TeacherRecord | ParentRecord | Student | null,
  fallback: string
): string => {
  if (!identity) return fallback;
  if ("primaryPhone" in identity && identity.primaryPhone) return identity.primaryPhone;
  if ("phone" in identity && identity.phone) return identity.phone;
  return fallback;
};

const getIdentityStatus = (
  identity: TeacherRecord | ParentRecord | Student | null
): string | undefined => {
  return identity && "status" in identity ? identity.status : undefined;
};

const getIdentityUserId = (
  identity: TeacherRecord | ParentRecord | Student | null
): string | undefined => {
  return identity && "userId" in identity ? identity.userId : undefined;
};

const isIdentityArchived = (
  identity: TeacherRecord | ParentRecord | Student | null
): boolean => Boolean(identity && "archivedAt" in identity && identity.archivedAt);

export const useIamManagement = ({
  api,
  initialUsers = [],
  students,
  remoteEnabled = true,
  onError,
  onNotice,
  onUsersChange,
  translate = (source) => source
}: UseIamManagementOptions) => {
  const confirmAction = useConfirmDialog();
  const [users, setUsers] = useState<UserAccount[]>(initialUsers);
  const [accountTeachers, setAccountTeachers] = useState<TeacherRecord[]>([]);
  const [accountParents, setAccountParents] = useState<ParentRecord[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<IamUserForm>(() => buildDefaultUserForm());
  const [rolePermissionTarget, setRolePermissionTarget] = useState<Role>("ADMIN");
  const [rolePermissions, setRolePermissions] = useState<RolePermissionView[]>(
    remoteEnabled ? [] : PREVIEW_ROLE_PERMISSIONS
  );
  const [userErrors, setUserErrors] = useState<FieldErrors>({});
  const [iamWorkflowStep, setIamWorkflowStep] = useState("accounts");

  const setUsersAndNotify = useCallback(
    (nextUsers: UserAccount[]) => {
      setUsers(nextUsers);
      onUsersChange?.(nextUsers);
    },
    [onUsersChange]
  );

  const loadUsers = useCallback(async () => {
    if (!remoteEnabled) {
      setUsersAndNotify(initialUsers);
      return;
    }
    try {
      setUsersAndNotify(await fetchIamUsers(api));
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    }
  }, [api, initialUsers, onError, remoteEnabled, setUsersAndNotify]);

  const loadIamAccountReferences = useCallback(async () => {
    if (!remoteEnabled) {
      setAccountTeachers([]);
      setAccountParents([]);
      return;
    }
    try {
      const references = await fetchIamAccountReferences(api);
      setAccountTeachers(references.teachers);
      setAccountParents(references.parents);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    }
  }, [api, onError, remoteEnabled]);

  const loadRolePermissions = useCallback(
    async (role: Role = rolePermissionTarget) => {
      if (!remoteEnabled) {
        setRolePermissions(PREVIEW_ROLE_PERMISSIONS.filter((item) => item.role === role));
        return;
      }
      try {
        setRolePermissions(await fetchRolePermissions(api, role));
      } catch (error) {
        onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
      }
    },
    [api, onError, remoteEnabled, rolePermissionTarget]
  );

  useEffect(() => {
    void loadUsers();
    void loadIamAccountReferences();
  }, [loadIamAccountReferences, loadUsers]);

  useEffect(() => {
    void loadRolePermissions(rolePermissionTarget);
  }, [loadRolePermissions, rolePermissionTarget]);

  const compatibleUserRoles = ACCOUNT_TYPE_ROLE_OPTIONS[userForm.accountType];
  const selectedAccountTeacher = accountTeachers.find((teacher) => teacher.id === userForm.teacherId) || null;
  const selectedAccountParent = accountParents.find((parent) => parent.id === userForm.parentId) || null;
  const selectedAccountStudent = students.find((student) => student.id === userForm.studentId) || null;
  const selectedBusinessIdentity =
    userForm.accountType === "TEACHER"
      ? selectedAccountTeacher
      : userForm.accountType === "PARENT"
        ? selectedAccountParent
        : userForm.accountType === "STUDENT"
          ? selectedAccountStudent
          : null;
  const selectedBusinessDisplayName = getIdentityDisplayName(
    selectedBusinessIdentity,
    userForm.staffDisplayName || userForm.displayName
  );
  const selectedBusinessEmail = getIdentityEmail(selectedBusinessIdentity, userForm.email);
  const selectedBusinessPhone = getIdentityPhone(selectedBusinessIdentity, userForm.phone);
  const selectedBusinessStatus = getIdentityStatus(selectedBusinessIdentity);
  const selectedBusinessUserId = getIdentityUserId(selectedBusinessIdentity);
  const selectedBusinessAlreadyLinked = Boolean(selectedBusinessUserId && selectedBusinessUserId !== editingUserId);
  const selectedBusinessIsInactive =
    Boolean(selectedBusinessStatus && selectedBusinessStatus !== "ACTIVE") ||
    isIdentityArchived(selectedBusinessIdentity);

  const setUserAccountType = (accountType: AccountType): void => {
    setUserForm((previous) => ({
      ...previous,
      accountType,
      roleId: ACCOUNT_TYPE_ROLE_OPTIONS[accountType][0],
      teacherId: "",
      parentId: "",
      studentId: "",
      autoFillIdentity: true
    }));
    setUserErrors({});
  };

  const resetUserForm = (): void => {
    setEditingUserId(null);
    setUserForm(buildDefaultUserForm());
    setUserErrors({});
  };

  const getEffectivePermission = (
    resource: PermissionResource,
    action: PermissionAction
  ): boolean => {
    const row = rolePermissions.find(
      (item) => item.resource === resource && item.action === action
    );
    return row?.allowed ?? false;
  };

  const toggleRolePermission = (
    resource: PermissionResource,
    action: PermissionAction,
    allowed: boolean
  ): void => {
    setRolePermissions((previous) => {
      const index = previous.findIndex(
        (item) => item.resource === resource && item.action === action
      );

      if (index < 0) {
        return [
          ...previous,
          {
            role: rolePermissionTarget,
            resource,
            action,
            allowed,
            source: "CUSTOM"
          }
        ];
      }

      const next = [...previous];
      next[index] = {
        ...next[index],
        allowed,
        source: "CUSTOM"
      };
      return next;
    });
  };

  const submitUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    const errors: FieldErrors = {};
    if (!userForm.username.trim()) errors.username = UI_MESSAGES.validationError;
    if (!compatibleUserRoles.includes(userForm.roleId)) {
      errors.roleId = UI_MESSAGES.validationError;
    }
    if (userForm.accountType === "STAFF" && !userForm.staffDisplayName.trim()) {
      errors.staffDisplayName = UI_MESSAGES.validationError;
    }
    if (userForm.accountType === "TEACHER" && !userForm.teacherId) {
      errors.teacherId = UI_MESSAGES.validationError;
    }
    if (userForm.accountType === "PARENT" && !userForm.parentId) {
      errors.parentId = UI_MESSAGES.validationError;
    }
    if (userForm.accountType === "STUDENT" && !userForm.studentId) {
      errors.studentId = UI_MESSAGES.validationError;
    }
    if (selectedBusinessAlreadyLinked) {
      errors.businessProfile = UI_MESSAGES.conflict;
    }
    if (selectedBusinessIsInactive) {
      errors.businessProfile = UI_MESSAGES.validationError;
    }
    setUserErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("accounts");
      return;
    }

    const payload: Record<string, unknown> = {
      username: userForm.username.trim(),
      email: userForm.email.trim() || undefined,
      phone: userForm.phone.trim() || undefined,
      accountType: userForm.accountType,
      roleId: userForm.roleId,
      teacherId: userForm.accountType === "TEACHER" ? userForm.teacherId : undefined,
      parentId: userForm.accountType === "PARENT" ? userForm.parentId : undefined,
      studentId: userForm.accountType === "STUDENT" ? userForm.studentId : undefined,
      autoFillIdentity: userForm.autoFillIdentity,
      staffDisplayName: userForm.accountType === "STAFF" ? userForm.staffDisplayName.trim() : undefined,
      staffFunction: userForm.staffFunction.trim() || undefined,
      department: userForm.department.trim() || undefined,
      displayName: userForm.displayName.trim() || undefined,
      establishmentId: userForm.establishmentId || undefined,
      notes: userForm.notes.trim() || undefined,
      mustChangePasswordAtFirstLogin: false,
      status: userForm.status,
      sendActivationEmail: !editingUserId ? userForm.sendActivationEmail : undefined,
      isActive: userForm.status === "ACTIVE"
    };

    try {
      const savedUser = await upsertIamUser(api, editingUserId, payload);
      setUserErrors({});
      if (editingUserId) {
        onNotice(UI_MESSAGES.updated);
      } else if (savedUser.activationEmailSent) {
        onNotice(UI_MESSAGES.userCreatedAndActivationSent);
      } else if (savedUser.activationEmailError) {
        onNotice(UI_MESSAGES.userCreatedActivationFailed);
      } else {
        onNotice(UI_MESSAGES.created);
      }
      setIamWorkflowStep("accounts");
      resetUserForm();
      await loadUsers();
      await loadIamAccountReferences();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const startEditUser = (item: UserAccount): void => {
    const accountType =
      item.accountType ||
      (item.role === "ENSEIGNANT"
        ? "TEACHER"
        : item.role === "PARENT"
          ? "PARENT"
          : item.role === "STUDENT"
            ? "STUDENT"
            : "STAFF");
    setEditingUserId(item.id);
    setUserForm({
      username: item.username,
      email: item.email || "",
      phone: item.phone || "",
      passwordMode: "MANUAL",
      password: "",
      confirmPassword: "",
      accountType,
      roleId: item.roleId || item.role,
      teacherId: item.teacherId || "",
      parentId: item.parentId || "",
      studentId: item.studentId || "",
      autoFillIdentity: true,
      staffDisplayName: item.accountType === "STAFF" ? item.displayName || "" : "",
      staffFunction: item.staffFunction || "",
      department: item.department || "",
      displayName: item.displayName || "",
      establishmentId: item.establishmentId || "",
      notes: item.notes || "",
      mustChangePasswordAtFirstLogin: item.mustChangePasswordAtFirstLogin ?? false,
      status: (item.status as typeof userForm.status) || (item.isActive ? "ACTIVE" : "INACTIVE"),
      sendActivationEmail: false,
      isActive: item.isActive
    });
    setUserErrors({});
    setIamWorkflowStep("accounts");
  };

  const deleteUserAccount = async (id: string): Promise<void> => {
    if (!(await confirmAction({ description: translate(UI_MESSAGES.userDeleteConfirm), confirmLabel: translate("Supprimer"), tone: "danger" }))) return;
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await removeIamUser(api, id);
      if (editingUserId === id) {
        resetUserForm();
      }
      onNotice(UI_MESSAGES.deleted);
      await loadUsers();
      await loadIamAccountReferences();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.deleteError));
    }
  };

  const toggleUserAccountStatus = async (item: UserAccount, isActive: boolean): Promise<void> => {
    const confirmation = isActive
      ? UI_MESSAGES.userActivateConfirm
      : UI_MESSAGES.userDeactivateConfirm;
    if (!(await confirmAction({
      description: translate(confirmation),
      confirmLabel: translate(isActive ? "Activer" : "Désactiver"),
      tone: isActive ? "default" : "danger"
    }))) return;
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      const updatedUser = await upsertIamUser(api, item.id, { isActive });
      setUsersAndNotify(users.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
      if (editingUserId === updatedUser.id) {
        setUserForm((previous) => ({ ...previous, isActive: updatedUser.isActive }));
      }
      onNotice(isActive ? UI_MESSAGES.accountReactivated : UI_MESSAGES.accountDeactivated);
      await loadUsers();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const resendUserActivation = async (item: UserAccount): Promise<void> => {
    if (!(await confirmAction({
      description: translate(UI_MESSAGES.activationResendConfirm),
      confirmLabel: translate("Renvoyer")
    }))) return;
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      await sendIamUserActivation(api, item.id);
      onNotice(UI_MESSAGES.activationSent);
      await loadUsers();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const saveCurrentRolePermissions = async (): Promise<void> => {
    onError(null);
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      setIamWorkflowStep("permissions");
      return;
    }

    const permissions = PERMISSION_RESOURCE_VALUES.flatMap((resource) =>
      PERMISSION_ACTION_VALUES.map((action) => ({
        resource,
        action,
        allowed: getEffectivePermission(resource, action)
      }))
    );

    try {
      setRolePermissions(await saveRolePermissions(api, rolePermissionTarget, permissions));
      onNotice(UI_MESSAGES.saved);
      setIamWorkflowStep("permissions");
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const iamSteps = useMemo(
    () => [
      {
        id: "accounts",
        title: editingUserId ? "Édition compte" : "Comptes utilisateurs",
        hint: "Créer, modifier et désactiver les comptes.",
        done: users.length > 0
      },
      {
        id: "permissions",
        title: "Droits par profil",
        hint: "Sélectionner les actions autorisées par ressource.",
        done: rolePermissions.some((item) => item.source === "CUSTOM")
      }
    ],
    [editingUserId, rolePermissions, users.length]
  );

  return {
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
    rolePermissions,
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
  };
};
