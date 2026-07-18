import { useCallback, useMemo, useState, type MutableRefObject } from "react";

import type {
  Enrollment,
  FeePlan,
  Invoice,
  MosqueeDashboard,
  ParentRecord,
  ParentStudentRelation,
  PaymentRecord,
  RecoveryDashboard,
  ReportCard,
  Role,
  Session,
  Student,
  UserAccount,
  UserSelfProfile
} from "../shared/types/app";
import type { ParentPortalData } from "../features/portal/types/portal-parent";
import type { TeacherPortalData } from "../features/portal/types/portal-teacher";
import type { ReferenceData } from "../features/reference/types/reference";
import {
  loadEnrollmentsData,
  loadFinanceData,
  loadReferenceData,
  loadReportCardsData,
  loadStudentsData,
  loadUsersData,
  type AppApiClient
} from "./app-data-loaders";
import type { PreviewAppData } from "./preview/preview-data";

export type AppFinanceData = {
  feePlans: FeePlan[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  recovery: RecoveryDashboard | null;
};

export type AppParentDirectoryData = {
  records: ParentRecord[];
  relations: ParentStudentRelation[];
};

export type AppDomainData = {
  currentProfile: UserSelfProfile | null;
  enrollments: Enrollment[];
  finance: AppFinanceData;
  mosqueeDashboard: MosqueeDashboard | null;
  parentDirectory: AppParentDirectoryData;
  parentPortal: ParentPortalData;
  reference: ReferenceData;
  reportCards: ReportCard[];
  students: Student[];
  teacherPortal: TeacherPortalData;
  users: UserAccount[];
};

const createEmptyReferenceData = (): ReferenceData => ({
  schoolYears: [],
  cycles: [],
  levels: [],
  classes: [],
  subjects: [],
  periods: []
});

const createEmptyFinanceData = (): AppFinanceData => ({
  feePlans: [],
  invoices: [],
  payments: [],
  recovery: null
});

const createEmptyTeacherPortalData = (): TeacherPortalData => ({
  overview: null,
  classes: [],
  students: [],
  grades: [],
  timetable: [],
  notifications: []
});

const createEmptyParentPortalData = (): ParentPortalData => ({
  overview: null,
  children: [],
  grades: [],
  reportCards: [],
  attendance: [],
  invoices: [],
  payments: [],
  timetable: [],
  notifications: []
});

export const createEmptyAppDomainData = (): AppDomainData => ({
  currentProfile: null,
  enrollments: [],
  finance: createEmptyFinanceData(),
  mosqueeDashboard: null,
  parentDirectory: { records: [], relations: [] },
  parentPortal: createEmptyParentPortalData(),
  reference: createEmptyReferenceData(),
  reportCards: [],
  students: [],
  teacherPortal: createEmptyTeacherPortalData(),
  users: []
});

export type AppDomainActions = {
  applyPreviewData: (preview: PreviewAppData) => void;
  clearData: () => void;
  setCurrentProfile: (profile: UserSelfProfile | null) => void;
  setEnrollments: (rows: Enrollment[]) => void;
  setFinance: (data: AppFinanceData) => void;
  setMosqueeDashboard: (dashboard: MosqueeDashboard | null) => void;
  setParentDirectory: (data: AppParentDirectoryData) => void;
  setParentPortal: (data: ParentPortalData) => void;
  setReference: (data: ReferenceData) => void;
  setReportCards: (rows: ReportCard[]) => void;
  setStudents: (rows: Student[]) => void;
  setTeacherPortal: (data: TeacherPortalData) => void;
  setUsers: (rows: UserAccount[]) => void;
};

export type AppDomainController = {
  actions: AppDomainActions;
  data: AppDomainData;
};

export function useAppDomainState(): AppDomainController {
  const [data, setData] = useState<AppDomainData>(() => createEmptyAppDomainData());

  const clearData = useCallback((): void => {
    setData(createEmptyAppDomainData());
  }, []);
  const setStudents = useCallback((rows: Student[]): void => {
    setData((current) => ({ ...current, students: rows }));
  }, []);
  const setReference = useCallback((reference: ReferenceData): void => {
    setData((current) => ({ ...current, reference }));
  }, []);
  const setEnrollments = useCallback((rows: Enrollment[]): void => {
    setData((current) => ({ ...current, enrollments: rows }));
  }, []);
  const setFinance = useCallback((finance: AppFinanceData): void => {
    setData((current) => ({ ...current, finance }));
  }, []);
  const setReportCards = useCallback((rows: ReportCard[]): void => {
    setData((current) => ({ ...current, reportCards: rows }));
  }, []);
  const setUsers = useCallback((rows: UserAccount[]): void => {
    setData((current) => ({ ...current, users: rows }));
  }, []);
  const setCurrentProfile = useCallback((currentProfile: UserSelfProfile | null): void => {
    setData((current) => ({ ...current, currentProfile }));
  }, []);
  const setTeacherPortal = useCallback((teacherPortal: TeacherPortalData): void => {
    setData((current) => ({ ...current, teacherPortal }));
  }, []);
  const setParentDirectory = useCallback((parentDirectory: AppParentDirectoryData): void => {
    setData((current) => ({ ...current, parentDirectory }));
  }, []);
  const setParentPortal = useCallback((parentPortal: ParentPortalData): void => {
    setData((current) => ({ ...current, parentPortal }));
  }, []);
  const setMosqueeDashboard = useCallback((mosqueeDashboard: MosqueeDashboard | null): void => {
    setData((current) => ({ ...current, mosqueeDashboard }));
  }, []);
  const applyPreviewData = useCallback((preview: PreviewAppData): void => {
    setData({
      ...createEmptyAppDomainData(),
      enrollments: preview.enrollments,
      finance: {
        feePlans: preview.feePlans,
        invoices: preview.invoices,
        payments: preview.payments,
        recovery: preview.recovery
      },
      mosqueeDashboard: preview.mosqueeDashboard,
      parentDirectory: {
        records: preview.parents,
        relations: preview.parentRelations
      },
      reference: {
        schoolYears: preview.schoolYears,
        cycles: preview.cycles,
        levels: preview.levels,
        classes: preview.classes,
        subjects: preview.subjects,
        periods: preview.periods
      },
      reportCards: preview.reportCards,
      students: preview.students,
      users: preview.users
    });
  }, []);

  const actions = useMemo<AppDomainActions>(
    () => ({
      applyPreviewData,
      clearData,
      setCurrentProfile,
      setEnrollments,
      setFinance,
      setMosqueeDashboard,
      setParentDirectory,
      setParentPortal,
      setReference,
      setReportCards,
      setStudents,
      setTeacherPortal,
      setUsers
    }),
    [
      applyPreviewData,
      clearData,
      setCurrentProfile,
      setEnrollments,
      setFinance,
      setMosqueeDashboard,
      setParentDirectory,
      setParentPortal,
      setReference,
      setReportCards,
      setStudents,
      setTeacherPortal,
      setUsers
    ]
  );

  return { actions, data };
}

type EnrollmentFilters = {
  classId?: string;
  schoolYearId?: string;
  studentId?: string;
  track?: string;
};

type UseAppDataLoadersOptions = {
  actions: AppDomainActions;
  api: AppApiClient;
  currentRole: Role | null;
  onError: (message: string | null) => void;
  sessionRef: MutableRefObject<Session | null>;
};

export function useAppDataLoaders({
  actions,
  api,
  currentRole,
  onError,
  sessionRef
}: UseAppDataLoadersOptions) {
  const loadStudents = useCallback(async (): Promise<void> => {
    if (!sessionRef.current) return;
    const { data, error } = await loadStudentsData(api);
    actions.setStudents(data);
    if (error) onError(error);
  }, [actions, api, onError, sessionRef]);

  const loadUsers = useCallback(async (): Promise<void> => {
    if (!sessionRef.current || !currentRole) return;
    const { data, error } = await loadUsersData(api, currentRole);
    actions.setUsers(data);
    if (error) onError(error);
  }, [actions, api, currentRole, onError, sessionRef]);

  const loadReference = useCallback(async (): Promise<void> => {
    if (!sessionRef.current) return;
    const { data, error } = await loadReferenceData(api);
    actions.setReference(data);
    if (error) onError(error);
  }, [actions, api, onError, sessionRef]);

  const loadEnrollments = useCallback(
    async (filters: EnrollmentFilters = {}): Promise<void> => {
      if (!sessionRef.current) return;
      const { data, error } = await loadEnrollmentsData(api, filters);
      actions.setEnrollments(data);
      if (error) onError(error);
    },
    [actions, api, onError, sessionRef]
  );

  const loadFinance = useCallback(async (): Promise<void> => {
    if (!sessionRef.current) return;
    const { data, error } = await loadFinanceData(api);
    if (data) actions.setFinance(data);
    if (error) onError(error);
  }, [actions, api, onError, sessionRef]);

  const loadReportCards = useCallback(async (): Promise<void> => {
    if (!sessionRef.current) return;
    const { data, error } = await loadReportCardsData(api);
    actions.setReportCards(data);
    if (error) onError(error);
  }, [actions, api, onError, sessionRef]);

  return {
    loadEnrollments,
    loadFinance,
    loadReference,
    loadReportCards,
    loadStudents,
    loadUsers
  };
}
