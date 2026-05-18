import type {
  AccountType,
  FieldErrors,
  PasswordMode,
  Role,
  UserStatus
} from "../../../shared/types/app";

export type IamApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type IamUserForm = {
  username: string;
  email: string;
  phone: string;
  passwordMode: PasswordMode;
  password: string;
  confirmPassword: string;
  accountType: AccountType;
  roleId: Role;
  teacherId: string;
  parentId: string;
  studentId: string;
  autoFillIdentity: boolean;
  staffDisplayName: string;
  staffFunction: string;
  department: string;
  displayName: string;
  avatarUrl: string;
  establishmentId: string;
  notes: string;
  mustChangePasswordAtFirstLogin: boolean;
  status: UserStatus;
  sendActivationEmail: boolean;
  isActive: boolean;
};

export type IamFieldErrors = FieldErrors;
