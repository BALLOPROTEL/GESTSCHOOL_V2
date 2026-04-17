import { UserRole } from "../security/roles.enum";

export type DefaultDevUser = {
  username: string;
  password: string;
  role: UserRole;
  accountType: "STAFF" | "TEACHER" | "PARENT" | "STUDENT";
};

export type DefaultDevUsersOptions = {
  includePortalUsers?: boolean;
};

const readValue = (key: string, fallback: string): string => {
  const value = process.env[key]?.trim();
  return value || fallback;
};

export const getDefaultDevUsers = (options: DefaultDevUsersOptions = {}): DefaultDevUser[] => {
  const staffUsers: DefaultDevUser[] = [
    {
      username: readValue("ADMIN_USERNAME", "admin@gestschool.local"),
      password: readValue("ADMIN_PASSWORD", "admin12345"),
      role: UserRole.ADMIN,
      accountType: "STAFF"
    },
    {
      username: readValue("SCOLARITE_USERNAME", "scolarite@gestschool.local"),
      password: readValue("SCOLARITE_PASSWORD", "scolarite123"),
      role: UserRole.SCOLARITE,
      accountType: "STAFF"
    },
    {
      username: readValue("COMPTABLE_USERNAME", "comptable@gestschool.local"),
      password: readValue("COMPTABLE_PASSWORD", "comptable123"),
      role: UserRole.COMPTABLE,
      accountType: "STAFF"
    }
  ];

  if (!options.includePortalUsers) return staffUsers;

  return [
    ...staffUsers,
    {
      username: readValue("ENSEIGNANT_USERNAME", "enseignant@gestschool.local"),
      password: readValue("ENSEIGNANT_PASSWORD", "teacher1234"),
      role: UserRole.ENSEIGNANT,
      accountType: "TEACHER"
    },
    {
      username: readValue("PARENT_USERNAME", "parent@gestschool.local"),
      password: readValue("PARENT_PASSWORD", "parent1234"),
      role: UserRole.PARENT,
      accountType: "PARENT"
    }
  ];
};
