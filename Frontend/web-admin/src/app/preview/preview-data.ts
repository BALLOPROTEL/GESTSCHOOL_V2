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
  ParentRecord,
  ParentStudentRelation,
  RecoveryDashboard,
  ReportCard,
  SchoolYear,
  Session,
  Student,
  Subject,
  UserAccount
} from "../../shared/types/app";
import { LOCAL_PREVIEW_ACCESS_TOKEN } from "../../shared/services/local-preview-session";

export type PreviewAppData = {
  session: Session;
  schoolYears: SchoolYear[];
  cycles: Cycle[];
  levels: Level[];
  classes: ClassItem[];
  subjects: Subject[];
  periods: Period[];
  students: Student[];
  parents: ParentRecord[];
  parentRelations: ParentStudentRelation[];
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
  const previewLevelArabophoneId = "preview-level-ar5";
  const previewClassPrimaryId = "preview-class-cm2a";
  const previewClassSecondaryId = "preview-class-6ea";
  const previewClassArabophoneId = "preview-class-ar5a";
  const previewPeriodId = "preview-period-t1";
  const previewStudentAId = "preview-student-a";
  const previewStudentBId = "preview-student-b";
  const previewStudentCId = "preview-student-c";
  const previewParentAId = "preview-parent-a";
  const previewParentB1Id = "preview-parent-b1";
  const previewParentB2Id = "preview-parent-b2";
  const previewParentUserAId = "preview-user-parent-a";

  return {
    session: {
      accessToken: LOCAL_PREVIEW_ACCESS_TOKEN,
      refreshToken: LOCAL_PREVIEW_ACCESS_TOKEN,
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
      },
      {
        id: previewLevelArabophoneId,
        cycleId: previewCyclePrimaryId,
        code: "AR5",
        label: "Arabe 5",
        alias: "Arabe 5",
        track: "ARABOPHONE",
        sortOrder: 6,
        status: "ACTIVE",
        theoreticalAge: 10,
        defaultSection: "Arabe"
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
      },
      {
        id: previewClassArabophoneId,
        schoolYearId: previewSchoolYearId,
        levelId: previewLevelArabophoneId,
        code: "AR5-A",
        label: "Arabe 5 A",
        track: "ARABOPHONE",
        capacity: 28,
        status: "ACTIVE",
        homeroomTeacherName: "Mme Diakite",
        mainRoom: "Salle A-01",
        actualCapacity: 24,
        description: "Groupe arabophone rattache aux inscriptions",
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
        fullName: "Aicha Diallo",
        sex: "F",
        birthDate: "2014-05-12",
        status: "ACTIVE",
        tracks: ["FRANCOPHONE", "ARABOPHONE"],
        placements: [
          {
            placementId: "preview-placement-a-fr",
            track: "FRANCOPHONE",
            placementStatus: "ACTIVE",
            isPrimary: true,
            schoolYearId: previewSchoolYearId,
            schoolYearCode: "2025-2026",
            levelId: previewLevelPrimaryId,
            levelLabel: "CM2",
            classId: previewClassPrimaryId,
            classLabel: "CM2 A"
          },
          {
            placementId: "preview-placement-a-ar",
            track: "ARABOPHONE",
            placementStatus: "ACTIVE",
            isPrimary: false,
            schoolYearId: previewSchoolYearId,
            schoolYearCode: "2025-2026",
            levelId: previewLevelArabophoneId,
            levelLabel: "Arabe 5",
            classId: previewClassArabophoneId,
            classLabel: "Arabe 5 A"
          }
        ],
        parents: [
          {
            linkId: "preview-parent-link-a",
            parentId: previewParentAId,
            parentName: "Mariam Diallo",
            relationType: "MERE",
            isPrimaryContact: true,
            legalGuardian: true,
            financialResponsible: true,
            emergencyContact: true,
            status: "ACTIVE"
          }
        ]
      },
      {
        id: previewStudentBId,
        matricule: "GS-2025-002",
        firstName: "Moussa",
        lastName: "Traore",
        fullName: "Moussa Traore",
        sex: "M",
        birthDate: "2013-11-03",
        status: "ACTIVE",
        tracks: ["FRANCOPHONE"],
        placements: [
          {
            placementId: "preview-placement-b-fr",
            track: "FRANCOPHONE",
            placementStatus: "ACTIVE",
            isPrimary: true,
            schoolYearId: previewSchoolYearId,
            schoolYearCode: "2025-2026",
            levelId: previewLevelSecondaryId,
            levelLabel: "6e",
            classId: previewClassSecondaryId,
            classLabel: "6e A"
          }
        ],
        parents: [
          {
            linkId: "preview-parent-link-b1",
            parentId: previewParentB1Id,
            parentName: "Ousmane Traore",
            relationType: "PERE",
            isPrimaryContact: true,
            legalGuardian: true,
            financialResponsible: true,
            emergencyContact: true,
            status: "ACTIVE"
          },
          {
            linkId: "preview-parent-link-b2",
            parentId: previewParentB2Id,
            parentName: "Fatou Traore",
            relationType: "MERE",
            isPrimaryContact: false,
            legalGuardian: true,
            financialResponsible: false,
            emergencyContact: true,
            status: "ACTIVE"
          }
        ]
      },
      {
        id: previewStudentCId,
        matricule: "GS-2025-003",
        firstName: "Khadija",
        lastName: "Sow",
        fullName: "Khadija Sow",
        sex: "F",
        birthDate: "2015-02-21",
        status: "PENDING",
        tracks: [],
        placements: []
      }
    ],
    parents: [
      {
        id: previewParentAId,
        tenantId,
        parentalRole: "MERE",
        firstName: "Mariam",
        lastName: "Diallo",
        fullName: "Mariam Diallo",
        sex: "F",
        primaryPhone: "+221 77 120 45 18",
        secondaryPhone: "+221 76 410 11 20",
        email: "mariam.diallo@example.com",
        address: "Parcelle 14, Dakar",
        profession: "Commerçante",
        identityDocumentType: "CNI",
        identityDocumentNumber: "SN-AD-001",
        status: "ACTIVE",
        establishmentId: "preview-establishment-main",
        userId: previewParentUserAId,
        userUsername: "parent.diallo",
        notes: "Contact prioritaire pour les convocations.",
        childrenCount: 1,
        primaryChildrenCount: 1,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: previewParentB1Id,
        tenantId,
        parentalRole: "PERE",
        firstName: "Ousmane",
        lastName: "Traore",
        fullName: "Ousmane Traore",
        sex: "M",
        primaryPhone: "+221 78 200 33 44",
        email: "ousmane.traore@example.com",
        address: "Sicap Liberté 2, Dakar",
        profession: "Technicien",
        identityDocumentType: "Passeport",
        identityDocumentNumber: "PT-77820",
        status: "ACTIVE",
        establishmentId: "preview-establishment-main",
        notes: "Responsable financier principal.",
        childrenCount: 1,
        primaryChildrenCount: 1,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: previewParentB2Id,
        tenantId,
        parentalRole: "MERE",
        firstName: "Fatou",
        lastName: "Traore",
        fullName: "Fatou Traore",
        sex: "F",
        primaryPhone: "+221 77 600 22 11",
        address: "Sicap Liberté 2, Dakar",
        profession: "Infirmière",
        status: "ACTIVE",
        establishmentId: "preview-establishment-main",
        childrenCount: 1,
        primaryChildrenCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ],
    parentRelations: [
      {
        id: "preview-parent-link-a",
        tenantId,
        parentId: previewParentAId,
        studentId: previewStudentAId,
        relationType: "MERE",
        isPrimary: true,
        isPrimaryContact: true,
        livesWithStudent: true,
        pickupAuthorized: true,
        legalGuardian: true,
        financialResponsible: true,
        emergencyContact: true,
        status: "ACTIVE",
        parentName: "Mariam Diallo",
        parentUsername: "parent.diallo",
        studentMatricule: "GS-2025-001",
        studentName: "Aicha Diallo",
        studentTracks: ["FRANCOPHONE", "ARABOPHONE"],
        studentPlacements: [
          {
            placementId: "preview-placement-a-fr",
            track: "FRANCOPHONE",
            placementStatus: "ACTIVE",
            isPrimary: true,
            schoolYearId: previewSchoolYearId,
            schoolYearCode: "2025-2026",
            levelId: previewLevelPrimaryId,
            levelLabel: "CM2",
            classId: previewClassPrimaryId,
            classLabel: "CM2 A"
          },
          {
            placementId: "preview-placement-a-ar",
            track: "ARABOPHONE",
            placementStatus: "ACTIVE",
            isPrimary: false,
            schoolYearId: previewSchoolYearId,
            schoolYearCode: "2025-2026",
            levelId: previewLevelArabophoneId,
            levelLabel: "Arabe 5",
            classId: previewClassArabophoneId,
            classLabel: "Arabe 5 A"
          }
        ],
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "preview-parent-link-b1",
        tenantId,
        parentId: previewParentB1Id,
        studentId: previewStudentBId,
        relationType: "PERE",
        isPrimary: true,
        isPrimaryContact: true,
        livesWithStudent: true,
        pickupAuthorized: true,
        legalGuardian: true,
        financialResponsible: true,
        emergencyContact: true,
        status: "ACTIVE",
        parentName: "Ousmane Traore",
        studentMatricule: "GS-2025-002",
        studentName: "Moussa Traore",
        studentTracks: ["FRANCOPHONE"],
        studentPlacements: [
          {
            placementId: "preview-placement-b-fr",
            track: "FRANCOPHONE",
            placementStatus: "ACTIVE",
            isPrimary: true,
            schoolYearId: previewSchoolYearId,
            schoolYearCode: "2025-2026",
            levelId: previewLevelSecondaryId,
            levelLabel: "6e",
            classId: previewClassSecondaryId,
            classLabel: "6e A"
          }
        ],
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "preview-parent-link-b2",
        tenantId,
        parentId: previewParentB2Id,
        studentId: previewStudentBId,
        relationType: "MERE",
        isPrimary: false,
        isPrimaryContact: false,
        livesWithStudent: true,
        pickupAuthorized: true,
        legalGuardian: true,
        financialResponsible: false,
        emergencyContact: true,
        status: "ACTIVE",
        parentName: "Fatou Traore",
        studentMatricule: "GS-2025-002",
        studentName: "Moussa Traore",
        studentTracks: ["FRANCOPHONE"],
        studentPlacements: [
          {
            placementId: "preview-placement-b-fr",
            track: "FRANCOPHONE",
            placementStatus: "ACTIVE",
            isPrimary: true,
            schoolYearId: previewSchoolYearId,
            schoolYearCode: "2025-2026",
            levelId: previewLevelSecondaryId,
            levelLabel: "6e",
            classId: previewClassSecondaryId,
            classLabel: "6e A"
          }
        ],
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ],
    enrollments: [
      {
        id: "preview-enrollment-a",
        schoolYearId: previewSchoolYearId,
        classId: previewClassPrimaryId,
        studentId: previewStudentAId,
        track: "FRANCOPHONE",
        placementId: "preview-placement-a-fr",
        isPrimary: true,
        enrollmentDate: "2025-09-12",
        enrollmentStatus: "ENROLLED",
        studentName: "Aicha Diallo",
        classLabel: "CM2 A",
        schoolYearCode: "2025-2026"
      },
      {
        id: "preview-enrollment-a-ar",
        schoolYearId: previewSchoolYearId,
        classId: previewClassArabophoneId,
        studentId: previewStudentAId,
        track: "ARABOPHONE",
        placementId: "preview-placement-a-ar",
        isPrimary: false,
        enrollmentDate: "2025-09-12",
        enrollmentStatus: "ENROLLED",
        studentName: "Aicha Diallo",
        classLabel: "Arabe 5 A",
        schoolYearCode: "2025-2026"
      },
      {
        id: "preview-enrollment-b",
        schoolYearId: previewSchoolYearId,
        classId: previewClassSecondaryId,
        studentId: previewStudentBId,
        track: "FRANCOPHONE",
        placementId: "preview-placement-b-fr",
        isPrimary: true,
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
	        generatedAt: "2026-05-19T14:12:32.000Z",
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
	        generatedAt: "2026-05-19T14:12:32.000Z",
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
        accountType: "STAFF",
        displayName: "Administrateur Preview",
        status: "ACTIVE",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "preview-user-scolarite",
        tenantId,
        username: "scolarite.preview",
        role: "SCOLARITE",
        accountType: "STAFF",
        displayName: "Scolarité Preview",
        status: "ACTIVE",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: previewParentUserAId,
        tenantId,
        username: "parent.diallo",
        role: "PARENT",
        accountType: "PARENT",
        email: "mariam.diallo@example.com",
        phone: "+221 77 120 45 18",
        displayName: "Mariam Diallo",
        parentId: previewParentAId,
        status: "ACTIVE",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "preview-user-parent-pending",
        tenantId,
        username: "parent.attente@example.com",
        role: "PARENT",
        accountType: "PARENT",
        email: "parent.attente@example.com",
        phone: "+221 77 000 00 00",
        displayName: "Responsable en attente",
        status: "PENDING_ACTIVATION",
        isActive: false,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "preview-user-comptable",
        tenantId,
        username: "comptable.preview",
        role: "COMPTABLE",
        accountType: "STAFF",
        displayName: "Comptable Preview",
        status: "ACTIVE",
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
