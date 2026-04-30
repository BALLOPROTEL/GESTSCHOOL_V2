import type {
  ClassItem,
  Cycle,
  Enrollment,
  FeePlan,
  Invoice,
  Level,
  MosqueeDashboard,
  PaymentRecord,
  Period,
  RecoveryDashboard,
  ReportCard,
  SchoolYear,
  Session,
  Student,
  Subject,
  UserAccount
} from "../../shared/types/app";

export const PREVIEW_ACCESS_TOKEN = "__preview__";

export type PreviewAppData = {
  session: Session;
  schoolYears: SchoolYear[];
  cycles: Cycle[];
  levels: Level[];
  classes: ClassItem[];
  subjects: Subject[];
  periods: Period[];
  students: Student[];
  enrollments: Enrollment[];
  feePlans: FeePlan[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  recovery: RecoveryDashboard;
  reportCards: ReportCard[];
  users: UserAccount[];
  mosqueeDashboard: MosqueeDashboard;
  headerNotificationCount: number;
  lastSyncAt: string;
};

export const createPreviewAppData = (
  tenantId: string,
  defaultCurrency: string,
  nowIso = new Date().toISOString()
): PreviewAppData => {
  const previewSchoolYearId = "preview-sy-2025";
  const previewCyclePrimaryId = "preview-cycle-primary";
  const previewCycleSecondaryId = "preview-cycle-secondary";
  const previewLevelPrimaryId = "preview-level-cm2";
  const previewLevelSecondaryId = "preview-level-6e";
  const previewClassPrimaryId = "preview-class-cm2a";
  const previewClassSecondaryId = "preview-class-6ea";
  const previewPeriodId = "preview-period-t1";
  const previewStudentAId = "preview-student-a";
  const previewStudentBId = "preview-student-b";

  return {
    session: {
      accessToken: PREVIEW_ACCESS_TOKEN,
      refreshToken: PREVIEW_ACCESS_TOKEN,
      tenantId,
      user: {
        username: "preview.admin",
        role: "ADMIN",
        tenantId
      }
    },
    schoolYears: [
      {
        id: previewSchoolYearId,
        code: "AS-2025-2026",
        label: "2025-2026",
        startDate: "2025-09-01",
        endDate: "2026-06-30",
        status: "ACTIVE",
        isActive: true,
        isDefault: true,
        sortOrder: 2025,
        comment: "Annee de reference v2"
      }
    ],
    cycles: [
      {
        id: previewCyclePrimaryId,
        schoolYearId: previewSchoolYearId,
        code: "PRIM",
        label: "Cycle primaire",
        academicStage: "PRIMARY",
        sortOrder: 1,
        status: "ACTIVE",
        theoreticalAgeMin: 6,
        theoreticalAgeMax: 11
      },
      {
        id: previewCycleSecondaryId,
        schoolYearId: previewSchoolYearId,
        code: "SEC",
        label: "Cycle secondaire",
        academicStage: "SECONDARY",
        sortOrder: 2,
        status: "ACTIVE",
        theoreticalAgeMin: 12,
        theoreticalAgeMax: 18
      }
    ],
    levels: [
      {
        id: previewLevelPrimaryId,
        cycleId: previewCyclePrimaryId,
        code: "CM2",
        label: "CM2",
        alias: "CM2",
        track: "FRANCOPHONE",
        sortOrder: 5,
        status: "ACTIVE",
        theoreticalAge: 10,
        defaultSection: "General"
      },
      {
        id: previewLevelSecondaryId,
        cycleId: previewCycleSecondaryId,
        code: "6E",
        label: "6e",
        alias: "6e",
        track: "FRANCOPHONE",
        sortOrder: 1,
        status: "ACTIVE",
        theoreticalAge: 11,
        defaultSection: "College"
      }
    ],
    classes: [
      {
        id: previewClassPrimaryId,
        schoolYearId: previewSchoolYearId,
        levelId: previewLevelPrimaryId,
        code: "CM2-A",
        label: "CM2 A",
        track: "FRANCOPHONE",
        capacity: 32,
        status: "ACTIVE",
        homeroomTeacherName: "Mme Traore",
        mainRoom: "Salle P-02",
        actualCapacity: 30,
        description: "Classe de fin de primaire",
        teachingMode: "PRESENTIAL"
      },
      {
        id: previewClassSecondaryId,
        schoolYearId: previewSchoolYearId,
        levelId: previewLevelSecondaryId,
        code: "6E-A",
        label: "6e A",
        track: "FRANCOPHONE",
        capacity: 35,
        status: "ACTIVE",
        homeroomTeacherName: "M. Bah",
        mainRoom: "Salle C-06",
        actualCapacity: 33,
        description: "Classe d'entree au college",
        teachingMode: "PRESENTIAL"
      }
    ],
    subjects: [
      {
        id: "preview-subject-math",
        code: "MATH",
        label: "Mathematiques",
        isArabic: false,
        status: "ACTIVE",
        nature: "FRANCOPHONE",
        shortLabel: "Maths",
        defaultCoefficient: 4,
        category: "Scientifique",
        color: "#0f766e",
        weeklyHours: 5,
        isGraded: true,
        isOptional: false,
        levelIds: [previewLevelPrimaryId, previewLevelSecondaryId]
      },
      {
        id: "preview-subject-fr",
        code: "FR",
        label: "Francais",
        isArabic: false,
        status: "ACTIVE",
        nature: "FRANCOPHONE",
        shortLabel: "Francais",
        defaultCoefficient: 3,
        category: "Langues",
        color: "#2563eb",
        weeklyHours: 4,
        isGraded: true,
        isOptional: false,
        levelIds: [previewLevelPrimaryId, previewLevelSecondaryId]
      },
      {
        id: "preview-subject-ar",
        code: "AR",
        label: "Arabe",
        isArabic: true,
        status: "ACTIVE",
        nature: "ARABOPHONE",
        shortLabel: "Arabe",
        defaultCoefficient: 3,
        category: "Langues",
        color: "#7c3aed",
        weeklyHours: 4,
        isGraded: true,
        isOptional: false,
        levelIds: [previewLevelPrimaryId, previewLevelSecondaryId]
      }
    ],
    periods: [
      {
        id: previewPeriodId,
        schoolYearId: previewSchoolYearId,
        code: "T1",
        label: "Trimestre 1",
        startDate: "2025-09-01",
        endDate: "2025-12-20",
        periodType: "TRIMESTER",
        sortOrder: 1,
        status: "ACTIVE",
        isGradeEntryOpen: true,
        gradeEntryDeadline: "2025-12-15",
        lockDate: "2025-12-20"
      }
    ],
    students: [
      {
        id: previewStudentAId,
        matricule: "GS-2025-001",
        firstName: "Aicha",
        lastName: "Diallo",
        sex: "F",
        birthDate: "2014-05-12"
      },
      {
        id: previewStudentBId,
        matricule: "GS-2025-002",
        firstName: "Moussa",
        lastName: "Traore",
        sex: "M",
        birthDate: "2013-11-03"
      },
      {
        id: "preview-student-c",
        matricule: "GS-2025-003",
        firstName: "Khadija",
        lastName: "Sow",
        sex: "F",
        birthDate: "2015-02-21"
      }
    ],
    enrollments: [
      {
        id: "preview-enrollment-a",
        schoolYearId: previewSchoolYearId,
        classId: previewClassPrimaryId,
        studentId: previewStudentAId,
        track: "FRANCOPHONE",
        enrollmentDate: "2025-09-12",
        enrollmentStatus: "ENROLLED",
        studentName: "Aicha Diallo",
        classLabel: "CM2 A",
        schoolYearCode: "2025-2026"
      },
      {
        id: "preview-enrollment-b",
        schoolYearId: previewSchoolYearId,
        classId: previewClassSecondaryId,
        studentId: previewStudentBId,
        track: "FRANCOPHONE",
        enrollmentDate: "2025-09-12",
        enrollmentStatus: "ENROLLED",
        studentName: "Moussa Traore",
        classLabel: "6e A",
        schoolYearCode: "2025-2026"
      }
    ],
    feePlans: [
      {
        id: "preview-fee-cm2",
        schoolYearId: previewSchoolYearId,
        levelId: previewLevelPrimaryId,
        label: "Frais CM2",
        totalAmount: 185000,
        currency: defaultCurrency
      },
      {
        id: "preview-fee-6e",
        schoolYearId: previewSchoolYearId,
        levelId: previewLevelSecondaryId,
        label: "Frais 6e",
        totalAmount: 240000,
        currency: defaultCurrency
      }
    ],
    invoices: [
      {
        id: "preview-invoice-a",
        studentId: previewStudentAId,
        schoolYearId: previewSchoolYearId,
        feePlanId: "preview-fee-cm2",
        invoiceNo: "FAC-001",
        amountDue: 185000,
        amountPaid: 100000,
        remainingAmount: 85000,
        status: "PARTIAL",
        dueDate: "2025-10-10",
        studentName: "Aicha Diallo",
        schoolYearCode: "2025-2026",
        feePlanLabel: "Frais CM2",
        primaryTrack: "FRANCOPHONE",
        primaryClassId: previewClassPrimaryId,
        primaryClassLabel: "CM2 A",
        primaryLevelId: previewLevelPrimaryId,
        primaryLevelLabel: "CM2"
      },
      {
        id: "preview-invoice-b",
        studentId: previewStudentBId,
        schoolYearId: previewSchoolYearId,
        feePlanId: "preview-fee-6e",
        invoiceNo: "FAC-002",
        amountDue: 240000,
        amountPaid: 240000,
        remainingAmount: 0,
        status: "PAID",
        dueDate: "2025-10-12",
        studentName: "Moussa Traore",
        schoolYearCode: "2025-2026",
        feePlanLabel: "Frais 6e",
        primaryTrack: "FRANCOPHONE",
        primaryClassId: previewClassSecondaryId,
        primaryClassLabel: "6e A",
        primaryLevelId: previewLevelSecondaryId,
        primaryLevelLabel: "6e"
      }
    ],
    payments: [
      {
        id: "preview-payment-a",
        invoiceId: "preview-invoice-a",
        invoiceNo: "FAC-001",
        studentId: previewStudentAId,
        studentName: "Aicha Diallo",
        schoolYearId: previewSchoolYearId,
        receiptNo: "REC-001",
        paidAmount: 100000,
        paymentMethod: "MOBILE_MONEY",
        paidAt: nowIso,
        referenceExternal: "OM-9981"
      },
      {
        id: "preview-payment-b",
        invoiceId: "preview-invoice-b",
        invoiceNo: "FAC-002",
        studentId: previewStudentBId,
        studentName: "Moussa Traore",
        schoolYearId: previewSchoolYearId,
        receiptNo: "REC-002",
        paidAmount: 240000,
        paymentMethod: "BANK",
        paidAt: nowIso
      }
    ],
    recovery: {
      totals: {
        amountDue: 425000,
        amountPaid: 340000,
        remainingAmount: 85000,
        recoveryRatePercent: 80
      },
      invoices: {
        total: 2,
        open: 0,
        partial: 1,
        paid: 1,
        void: 0
      }
    },
    reportCards: [
      {
        id: "preview-report-a",
        studentId: previewStudentAId,
        classId: previewClassPrimaryId,
        track: "FRANCOPHONE",
        mode: "TRACK_SINGLE",
        academicPeriodId: previewPeriodId,
        averageGeneral: 15.8,
        classRank: 3,
        appreciation: "Bon travail",
        studentName: "Aicha Diallo",
        classLabel: "CM2 A",
        periodLabel: "Trimestre 1"
      },
      {
        id: "preview-report-b",
        studentId: previewStudentBId,
        classId: previewClassSecondaryId,
        track: "FRANCOPHONE",
        mode: "TRACK_SINGLE",
        academicPeriodId: previewPeriodId,
        averageGeneral: 13.9,
        classRank: 7,
        appreciation: "En progression",
        studentName: "Moussa Traore",
        classLabel: "6e A",
        periodLabel: "Trimestre 1"
      }
    ],
    users: [
      {
        id: "preview-user-admin",
        tenantId,
        username: "admin.preview",
        role: "ADMIN",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "preview-user-scolarite",
        tenantId,
        username: "scolarite.preview",
        role: "SCOLARITE",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "preview-user-comptable",
        tenantId,
        username: "comptable.preview",
        role: "COMPTABLE",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ],
    mosqueeDashboard: {
      totals: {
        members: 128,
        activeMembers: 109,
        activitiesThisMonth: 5,
        donationsThisMonth: 425000,
        donationsTotal: 3280000,
        averageDonation: 26500
      },
      donationsByChannel: [
        { channel: "CASH", count: 18, totalAmount: 240000 },
        { channel: "MOBILE_MONEY", count: 7, totalAmount: 185000 }
      ]
    },
    headerNotificationCount: 6,
    lastSyncAt: nowIso
  };
};
