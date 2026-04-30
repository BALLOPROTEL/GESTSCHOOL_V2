import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  ACCOUNT_TYPE_ROLE_OPTIONS,
  PERMISSION_ACTION_VALUES,
  PERMISSION_RESOURCE_VALUES,
  ROLE_LABELS
} from "../../../shared/constants/domain";
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
  upsertIamUser
} from "../services/iam-service";
import type { IamApiClient, IamUserForm } from "../types/iam";

type UseIamManagementOptions = {
  api: IamApiClient;
  initialUsers?: UserAccount[];
  students: Student[];
  remoteEnabled?: boolean;
  isStrongPassword: (value: string) => boolean;
  strongPasswordHint: string;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  onUsersChange?: (users: UserAccount[]) => void;
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
  avatarUrl: "",
  establishmentId: "",
  notes: "",
  mustChangePasswordAtFirstLogin: true,
  isActive: true
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
  isStrongPassword,
  strongPasswordHint,
  onError,
  onNotice,
  onUsersChange
}: UseIamManagementOptions) => {
  const [users, setUsers] = useState<UserAccount[]>(initialUsers);
  const [accountTeachers, setAccountTeachers] = useState<TeacherRecord[]>([]);
  const [accountParents, setAccountParents] = useState<ParentRecord[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<IamUserForm>(() => buildDefaultUserForm());
  const [lastTemporaryPassword, setLastTemporaryPassword] = useState("");
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
      onError(error instanceof Error ? error.message : "Erreur de chargement des utilisateurs.");
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
      onError(error instanceof Error ? error.message : "Erreur de chargement des rattachements IAM.");
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
        onError(error instanceof Error ? error.message : "Erreur de chargement des droits.");
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
    setLastTemporaryPassword("");
  };

  const resetUserForm = (): void => {
    setEditingUserId(null);
    setUserForm(buildDefaultUserForm());
    setLastTemporaryPassword("");
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
      onNotice("Mode apercu local : les comptes ne sont pas persistes.");
      return;
    }

    const errors: FieldErrors = {};
    if (!userForm.username.trim()) errors.username = "Nom utilisateur requis.";
    if (!compatibleUserRoles.includes(userForm.roleId)) {
      errors.roleId = "Role incompatible avec la nature du compte.";
    }
    if (userForm.accountType === "STAFF" && !userForm.staffDisplayName.trim()) {
      errors.staffDisplayName = "Nom affiche staff requis.";
    }
    if (userForm.accountType === "TEACHER" && !userForm.teacherId) {
      errors.teacherId = "Fiche enseignant requise.";
    }
    if (userForm.accountType === "PARENT" && !userForm.parentId) {
      errors.parentId = "Fiche parent requise.";
    }
    if (userForm.accountType === "STUDENT" && !userForm.studentId) {
      errors.studentId = "Fiche eleve requise.";
    }
    if (selectedBusinessAlreadyLinked) {
      errors.businessProfile = "Cette fiche metier est deja rattachee a un autre compte.";
    }
    if (selectedBusinessIsInactive) {
      errors.businessProfile = "La fiche metier doit etre active pour creer un compte actif.";
    }
    if (!editingUserId && userForm.passwordMode === "MANUAL" && !isStrongPassword(userForm.password.trim())) {
      errors.password = strongPasswordHint;
    }
    if (userForm.password.trim() && !isStrongPassword(userForm.password.trim())) {
      errors.password = strongPasswordHint;
    }
    if (userForm.passwordMode === "MANUAL" && userForm.password !== userForm.confirmPassword) {
      errors.confirmPassword = "La confirmation ne correspond pas.";
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
      avatarUrl: userForm.avatarUrl.trim() || undefined,
      establishmentId: userForm.establishmentId || undefined,
      notes: userForm.notes.trim() || undefined,
      mustChangePasswordAtFirstLogin: userForm.mustChangePasswordAtFirstLogin,
      isActive: userForm.isActive
    };
    if (!editingUserId) {
      payload.passwordMode = userForm.passwordMode;
    }
    if (userForm.passwordMode === "MANUAL" && userForm.password.trim()) {
      payload.password = userForm.password.trim();
      payload.confirmPassword = userForm.confirmPassword.trim();
    }

    try {
      const savedUser = await upsertIamUser(api, editingUserId, payload);
      setUserErrors({});
      setLastTemporaryPassword(savedUser.temporaryPassword || "");
      onNotice(editingUserId ? "Utilisateur mis a jour." : "Utilisateur cree.");
      setIamWorkflowStep("accounts");
      if (!savedUser.temporaryPassword) {
        resetUserForm();
      }
      await loadUsers();
      await loadIamAccountReferences();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'enregistrement utilisateur.");
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
      avatarUrl: item.avatarUrl || "",
      establishmentId: item.establishmentId || "",
      notes: item.notes || "",
      mustChangePasswordAtFirstLogin: item.mustChangePasswordAtFirstLogin ?? false,
      isActive: item.isActive
    });
    setLastTemporaryPassword("");
    setUserErrors({});
    setIamWorkflowStep("accounts");
  };

  const deleteUserAccount = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    if (!remoteEnabled) {
      onNotice("Mode apercu local : suppression non persistee.");
      return;
    }
    try {
      await removeIamUser(api, id);
      if (editingUserId === id) {
        resetUserForm();
      }
      onNotice("Utilisateur supprime.");
      await loadUsers();
      await loadIamAccountReferences();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de suppression utilisateur.");
    }
  };

  const saveCurrentRolePermissions = async (): Promise<void> => {
    onError(null);
    if (!remoteEnabled) {
      onNotice("Mode apercu local : droits non persistes.");
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
      onNotice(`Droits ${formatRoleLabel(rolePermissionTarget)} mis a jour.`);
      setIamWorkflowStep("permissions");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'enregistrement des droits.");
    }
  };

  const iamSteps = useMemo(
    () => [
      {
        id: "accounts",
        title: editingUserId ? "Edition compte" : "Comptes utilisateurs",
        hint: "Creer, modifier et desactiver les comptes.",
        done: users.length > 0
      },
      {
        id: "permissions",
        title: "Droits par profil",
        hint: "Ajuster les autorisations API par ressource et action.",
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
    lastTemporaryPassword,
    loadRolePermissions,
    resetUserForm,
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
    toggleRolePermission,
    userErrors,
    userForm,
    users
  };
};
