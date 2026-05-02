import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type {
  ClassItem,
  Cycle,
  Enrollment,
  FeePlan,
  GradeEntry,
  Invoice,
  Level,
  PaymentRecord,
  Period,
  RecoveryDashboard,
  ReportCard,
  RoomAssignmentRecord,
  RoomAvailabilityRecord,
  RoomOccupancyRecord,
  RoomRecord,
  RoomTypeRecord,
  SchoolYear,
  Student,
  Subject,
  TeacherPedagogicalAssignment,
  TeacherRecord,
  TeacherSkillRecord,
  TeacherWorkloadRecord,
  UserAccount
} from "../shared/types/app";
import { AuthScreen } from "./auth-screen";
import { EnrollmentsScreen } from "./enrollments/enrollments-screen";
import type { FinanceData } from "./finance/types/finance";
import { FinanceScreen } from "./finance/finance-screen";
import { GradesScreen } from "./grades/grades-screen";
import { PortalParentScreen } from "./portal/portal-parent-screen";
import type { ParentPortalData } from "./portal/types/portal-parent";
import { PortalTeacherScreen } from "./portal/portal-teacher-screen";
import type { TeacherPortalData } from "./portal/types/portal-teacher";
import { RoomsScreen } from "./rooms-screen";
import { StudentsScreen } from "./students/students-screen";
import { TeachersScreen } from "./teachers-screen";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

const schoolYear: SchoolYear = {
  id: "year-2026",
  code: "2025-2026",
  label: "Annee 2025-2026",
  startDate: "2025-10-01",
  endDate: "2026-07-31",
  isActive: true,
  status: "ACTIVE"
};

const cycle: Cycle = {
  id: "cycle-primary",
  code: "PRIM",
  label: "Primaire",
  academicStage: "PRIMARY",
  status: "ACTIVE"
};

const level: Level = {
  id: "level-cm2",
  cycleId: cycle.id,
  code: "CM2",
  label: "CM2",
  track: "FRANCOPHONE",
  status: "ACTIVE"
};

const arabophoneLevel: Level = {
  id: "level-ar-5",
  cycleId: cycle.id,
  code: "AR5",
  label: "Arabe 5",
  track: "ARABOPHONE",
  status: "ACTIVE"
};

const classroom: ClassItem = {
  id: "class-cm2-a",
  schoolYearId: schoolYear.id,
  levelId: level.id,
  code: "CM2-A",
  label: "CM2 A",
  track: "FRANCOPHONE",
  status: "ACTIVE"
};

const arabophoneClassroom: ClassItem = {
  id: "class-ar-5",
  schoolYearId: schoolYear.id,
  levelId: arabophoneLevel.id,
  code: "AR5",
  label: "Arabe 5",
  track: "ARABOPHONE",
  status: "ACTIVE"
};

const subject: Subject = {
  id: "subject-math",
  code: "MATH",
  label: "Mathematiques",
  isArabic: false,
  nature: "FRANCOPHONE",
  status: "ACTIVE"
};

const period: Period = {
  id: "period-t1",
  schoolYearId: schoolYear.id,
  code: "T1",
  label: "Trimestre 1",
  periodType: "TRIMESTER",
  status: "ACTIVE"
};

const student: Student = {
  id: "student-awa",
  tenantId: "tenant-1",
  matricule: "STD-001",
  firstName: "Awa",
  lastName: "Diallo",
  fullName: "Awa Diallo",
  sex: "F",
  birthDate: "2014-03-12",
  status: "ACTIVE",
  tracks: ["FRANCOPHONE", "ARABOPHONE"],
  placements: [
    {
      placementId: "placement-fr",
      track: "FRANCOPHONE",
      placementStatus: "ACTIVE",
      isPrimary: true,
      schoolYearId: schoolYear.id,
      schoolYearCode: schoolYear.code,
      levelId: level.id,
      levelLabel: level.label,
      classId: classroom.id,
      classLabel: classroom.label
    },
    {
      placementId: "placement-ar",
      track: "ARABOPHONE",
      placementStatus: "ACTIVE",
      isPrimary: false,
      schoolYearId: schoolYear.id,
      schoolYearCode: schoolYear.code,
      levelId: arabophoneLevel.id,
      levelLabel: arabophoneLevel.label,
      classId: arabophoneClassroom.id,
      classLabel: arabophoneClassroom.label
    }
  ],
  parents: [
    {
      linkId: "parent-link-1",
      parentId: "parent-1",
      parentName: "Aminata Diallo",
      relationType: "MERE",
      isPrimaryContact: true,
      legalGuardian: true,
      financialResponsible: true,
      emergencyContact: true,
      status: "ACTIVE"
    }
  ]
};

const enrollment: Enrollment = {
  id: "enrollment-1",
  schoolYearId: schoolYear.id,
  classId: classroom.id,
  studentId: student.id,
  track: "FRANCOPHONE",
  placementId: "placement-fr",
  isPrimary: true,
  enrollmentDate: "2025-10-01",
  enrollmentStatus: "ENROLLED",
  studentName: student.fullName,
  classLabel: classroom.label,
  schoolYearCode: schoolYear.code
};

const grade: GradeEntry = {
  id: "grade-1",
  studentId: student.id,
  studentName: student.fullName,
  classId: classroom.id,
  placementId: "placement-fr",
  track: "FRANCOPHONE",
  subjectId: subject.id,
  subjectLabel: subject.label,
  academicPeriodId: period.id,
  assessmentLabel: "Devoir 1",
  assessmentType: "DEVOIR",
  score: 16,
  scoreMax: 20,
  absent: false
};

const reportCard: ReportCard = {
  id: "report-1",
  studentId: student.id,
  classId: classroom.id,
  placementId: "placement-fr",
  track: "FRANCOPHONE",
  mode: "TRACK_SINGLE",
  academicPeriodId: period.id,
  averageGeneral: 15.75,
  classRank: 2,
  appreciation: "Bon trimestre",
  studentName: student.fullName,
  classLabel: classroom.label,
  periodLabel: period.label
};

const feePlan: FeePlan = {
  id: "fee-plan-1",
  schoolYearId: schoolYear.id,
  levelId: level.id,
  label: "Scolarite CM2",
  totalAmount: 150000,
  currency: "XOF"
};

const invoice: Invoice = {
  id: "invoice-1",
  studentId: student.id,
  schoolYearId: schoolYear.id,
  feePlanId: feePlan.id,
  invoiceNo: "INV-2026-001",
  amountDue: 150000,
  amountPaid: 50000,
  remainingAmount: 100000,
  status: "PARTIAL",
  studentName: student.fullName,
  schoolYearCode: schoolYear.code,
  feePlanLabel: feePlan.label,
  primaryTrack: "FRANCOPHONE",
  primaryClassId: classroom.id,
  primaryClassLabel: classroom.label,
  secondaryTrack: "ARABOPHONE",
  secondaryClassId: arabophoneClassroom.id,
  secondaryClassLabel: arabophoneClassroom.label
};

const payment: PaymentRecord = {
  id: "payment-1",
  invoiceId: invoice.id,
  invoiceNo: invoice.invoiceNo,
  studentId: student.id,
  studentName: student.fullName,
  schoolYearId: schoolYear.id,
  receiptNo: "REC-001",
  paidAmount: 50000,
  paymentMethod: "CASH",
  paidAt: "2026-01-10"
};

const recovery: RecoveryDashboard = {
  totals: {
    amountDue: 150000,
    amountPaid: 50000,
    remainingAmount: 100000,
    recoveryRatePercent: 33.33
  },
  invoices: {
    total: 1,
    open: 0,
    partial: 1,
    paid: 0,
    void: 0
  }
};

const financeData: FinanceData = {
  feePlans: [feePlan],
  invoices: [invoice],
  payments: [payment],
  recovery
};

const parentPortalData: ParentPortalData = {
  overview: {
    childrenCount: 1,
    openInvoicesCount: 1,
    remainingAmount: 100000,
    absencesCount: 1,
    reportCardsCount: 1,
    notificationsCount: 1
  },
  children: [
    {
      linkId: "parent-link-1",
      studentId: student.id,
      matricule: student.matricule,
      studentName: student.fullName || "Awa Diallo",
      isPrimary: true,
      primaryTrack: "FRANCOPHONE",
      primaryPlacement: {
        placementId: "placement-fr",
        track: "FRANCOPHONE",
        placementStatus: "ACTIVE",
        isPrimary: true,
        levelId: level.id,
        levelCode: level.code,
        levelLabel: level.label,
        classId: classroom.id,
        classLabel: classroom.label,
        schoolYearId: schoolYear.id,
        schoolYearCode: schoolYear.code
      },
      secondaryPlacement: {
        placementId: "placement-ar",
        track: "ARABOPHONE",
        placementStatus: "ACTIVE",
        isPrimary: false,
        levelId: arabophoneLevel.id,
        levelCode: arabophoneLevel.code,
        levelLabel: arabophoneLevel.label,
        classId: arabophoneClassroom.id,
        classLabel: arabophoneClassroom.label,
        schoolYearId: schoolYear.id,
        schoolYearCode: schoolYear.code
      },
      placements: [
        {
          placementId: "placement-fr",
          track: "FRANCOPHONE",
          placementStatus: "ACTIVE",
          isPrimary: true,
          levelId: level.id,
          levelCode: level.code,
          levelLabel: level.label,
          classId: classroom.id,
          classLabel: classroom.label,
          schoolYearId: schoolYear.id,
          schoolYearCode: schoolYear.code
        }
      ]
    }
  ],
  grades: [grade],
  reportCards: [reportCard],
  attendance: [
    {
      id: "attendance-1",
      studentId: student.id,
      studentName: student.fullName,
      classId: classroom.id,
      classLabel: classroom.label,
      placementId: "placement-fr",
      track: "FRANCOPHONE",
      attendanceDate: "2026-01-12",
      status: "ABSENT",
      justificationStatus: "PENDING"
    }
  ],
  invoices: [invoice],
  payments: [payment],
  timetable: [
    {
      slotId: "slot-1",
      studentId: student.id,
      studentName: student.fullName || "Awa Diallo",
      classId: classroom.id,
      classLabel: classroom.label,
      schoolYearId: schoolYear.id,
      schoolYearCode: schoolYear.code,
      placementId: "placement-fr",
      track: "FRANCOPHONE",
      subjectLabel: subject.label,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:00",
      room: "Salle 101",
      teacherName: "Mamadou Ndiaye"
    }
  ],
  notifications: [
    {
      id: "notification-1",
      studentId: student.id,
      studentName: student.fullName,
      audienceRole: "PARENT",
      title: "Retard",
      message: "Retard signale.",
      channel: "IN_APP",
      status: "SENT",
      createdAt: "2026-01-12"
    }
  ]
};

const teacherPortalData: TeacherPortalData = {
  overview: {
    classesCount: 1,
    studentsCount: 1,
    gradesCount: 1,
    pendingJustifications: 1,
    timetableSlotsCount: 1,
    notificationsCount: 1
  },
  classes: [
    {
      assignmentId: "teacher-assignment-1",
      classId: classroom.id,
      classLabel: classroom.label,
      schoolYearId: schoolYear.id,
      schoolYearCode: schoolYear.code,
      track: "FRANCOPHONE",
      subjectId: subject.id,
      subjectLabel: subject.label
    }
  ],
  students: [
    {
      enrollmentId: enrollment.id,
      placementId: "placement-fr",
      studentId: student.id,
      matricule: student.matricule,
      studentName: student.fullName || "Awa Diallo",
      classId: classroom.id,
      classLabel: classroom.label,
      schoolYearId: schoolYear.id,
      schoolYearCode: schoolYear.code,
      track: "FRANCOPHONE",
      placementStatus: "ACTIVE",
      isPrimary: true
    }
  ],
  grades: [grade],
  timetable: [
    {
      id: "teacher-slot-1",
      classId: classroom.id,
      classLabel: classroom.label,
      schoolYearId: schoolYear.id,
      schoolYearCode: schoolYear.code,
      track: "FRANCOPHONE",
      subjectId: subject.id,
      subjectLabel: subject.label,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:00",
      room: "Salle 101",
      teacherName: "Mamadou Ndiaye"
    }
  ],
  notifications: parentPortalData.notifications
};

const teacher: TeacherRecord = {
  id: "teacher-1",
  tenantId: "tenant-1",
  matricule: "ENS-001",
  firstName: "Mamadou",
  lastName: "Ndiaye",
  fullName: "Mamadou Ndiaye",
  primaryPhone: "+221770000001",
  email: "mamadou@example.com",
  teacherType: "PERMANENT",
  status: "ACTIVE",
  activeAssignmentsCount: 1,
  workloadHoursTotal: 12,
  francophoneWorkloadHoursTotal: 8,
  arabophoneWorkloadHoursTotal: 4,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

const roomType: RoomTypeRecord = {
  id: "room-type-class",
  code: "CLASS",
  name: "Salle de classe",
  status: "ACTIVE",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

const room: RoomRecord = {
  id: "room-101",
  code: "S101",
  name: "Salle 101",
  roomTypeId: roomType.id,
  roomTypeName: roomType.name,
  capacity: 32,
  status: "ACTIVE",
  isSharedBetweenCurricula: true,
  activeAssignmentsCount: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

const failingApi = vi.fn(async () => jsonResponse({}));

const buildModuleApi = (): ((path: string, init?: RequestInit) => Promise<Response>) =>
  vi.fn(async (path: string) => {
    const pathname = path.split("?")[0];
    const responses: Record<string, unknown> = {
      "/teachers": [teacher],
      "/teachers/skills": [
        {
          id: "teacher-skill-1",
          teacherId: teacher.id,
          subjectId: subject.id,
          subjectLabel: subject.label,
          track: "FRANCOPHONE",
          status: "ACTIVE",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01"
        } satisfies TeacherSkillRecord
      ],
      "/teachers/assignments": [
        {
          id: "teacher-assignment-1",
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          schoolYearId: schoolYear.id,
          schoolYearCode: schoolYear.code,
          classId: classroom.id,
          classLabel: classroom.label,
          subjectId: subject.id,
          subjectLabel: subject.label,
          track: "FRANCOPHONE",
          workloadHours: 8,
          isHomeroomTeacher: true,
          startDate: "2025-10-01",
          status: "ACTIVE",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01"
        } satisfies TeacherPedagogicalAssignment
      ],
      "/teachers/documents": [],
      "/teachers/workloads": [
        {
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          matricule: teacher.matricule,
          status: "ACTIVE",
          assignmentsCount: 1,
          workloadHoursTotal: 12,
          francophoneHoursTotal: 8,
          arabophoneHoursTotal: 4,
          francophoneAssignmentsCount: 1,
          arabophoneAssignmentsCount: 0,
          classesCount: 1,
          subjectsCount: 1,
          classes: [classroom.label],
          subjects: [subject.label]
        } satisfies TeacherWorkloadRecord
      ],
      "/rooms": [room],
      "/rooms/types": [roomType],
      "/rooms/assignments": [
        {
          id: "room-assignment-1",
          roomId: room.id,
          roomLabel: room.name,
          schoolYearId: schoolYear.id,
          schoolYearCode: schoolYear.code,
          classId: classroom.id,
          classLabel: classroom.label,
          track: "FRANCOPHONE",
          assignmentType: "CLASSROOM",
          status: "ACTIVE",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01"
        } satisfies RoomAssignmentRecord
      ],
      "/rooms/availabilities": [
        {
          id: "room-availability-1",
          roomId: room.id,
          roomLabel: room.name,
          dayOfWeek: 1,
          startTime: "08:00",
          endTime: "12:00",
          availabilityType: "AVAILABLE",
          schoolYearId: schoolYear.id,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01"
        } satisfies RoomAvailabilityRecord
      ],
      "/rooms/occupancy": [
        {
          roomId: room.id,
          roomLabel: room.name,
          roomTypeName: room.roomTypeName,
          capacity: room.capacity,
          status: room.status,
          isSharedBetweenCurricula: true,
          assignmentsCount: 1,
          francophoneAssignmentsCount: 1,
          arabophoneAssignmentsCount: 0,
          sharedAssignmentsCount: 0,
          classes: [classroom.label],
          subjects: [subject.label]
        } satisfies RoomOccupancyRecord
      ]
    };
    return jsonResponse(responses[pathname] ?? []);
  });

describe("critical frontend flows", () => {
  it("couvre l'ecran login avec statut API et actions d'assistance", () => {
    const handleLoginChange = vi.fn();
    const handleRemember = vi.fn();
    const handleSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const handleForgot = vi.fn();

    render(
      <AuthScreen
        apiStatus="offline"
        apiStatusText="API indisponible. Reconnexion..."
        authAssistLoading={false}
        authAssistMode="none"
        firstConnectionForm={{ username: "", temporaryPassword: "", newPassword: "", confirmPassword: "" }}
        forgotPasswordForm={{ username: "" }}
        languageBusy={false}
        loadingAuth={false}
        loginForm={{ username: "admin@gestschool.local", password: "password123" }}
        onEnterPreview={vi.fn()}
        onFirstConnectionChange={vi.fn()}
        onForgotPasswordChange={vi.fn()}
        onLoginFormChange={handleLoginChange}
        onRememberMeChange={handleRemember}
        onResetPasswordChange={vi.fn()}
        onSelectLanguage={vi.fn()}
        onSelectTheme={vi.fn()}
        onShowFirstConnection={vi.fn()}
        onShowForgotPassword={handleForgot}
        onShowLogin={vi.fn()}
        onSubmitFirstConnection={vi.fn()}
        onSubmitForgotPassword={vi.fn()}
        onSubmitLogin={handleSubmit}
        onSubmitResetPassword={vi.fn()}
        previewEnabled={false}
        rememberMe={false}
        resetPasswordForm={{ token: "", newPassword: "", confirmPassword: "" }}
        schoolName="Al Manarat Islamiyat"
        themeBusy={false}
        themeMode="dark"
        uiLanguage="fr"
      />
    );

    expect(screen.getByRole("heading", { name: "Connexion" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("API indisponible");

    expect(screen.getByPlaceholderText("Email ou Identifiant")).toHaveValue("admin@gestschool.local");
    fireEvent.click(screen.getByLabelText(/se souvenir de moi/i));
    fireEvent.click(screen.getByRole("button", { name: /^Connexion$/ }));
    fireEvent.click(screen.getByRole("button", { name: /mot de passe oublie/i }));

    expect(handleLoginChange).not.toHaveBeenCalled();
    expect(handleRemember).toHaveBeenCalledWith(true);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleForgot).toHaveBeenCalledTimes(1);
  });

  it("monte les flux eleves, inscriptions et bulletins avec des donnees bi-cursus", async () => {
    const user = userEvent.setup();

    render(
      <StudentsScreen
        api={failingApi}
        initialStudents={[student]}
        onError={vi.fn()}
        onNotice={vi.fn()}
        remoteEnabled={false}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Base eleves" }));
    expect(screen.getByRole("heading", { name: "Base eleves" })).toBeInTheDocument();
    expect(screen.getByText("Francophone + Arabophone")).toBeInTheDocument();
    expect(screen.getByText("Aminata Diallo")).toBeInTheDocument();
  });

  it("monte les inscriptions, notes et finance sans appel reseau en mode local", () => {
    const { unmount } = render(
      <EnrollmentsScreen
        api={failingApi}
        classes={[classroom, arabophoneClassroom]}
        initialEnrollments={[enrollment]}
        onError={vi.fn()}
        onNotice={vi.fn()}
        remoteEnabled={false}
        schoolYears={[schoolYear]}
        students={[student]}
      />
    );

    expect(screen.getByText("Pilotage des inscriptions")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nouvelle inscription" })).toBeInTheDocument();
    expect(screen.getAllByText("Awa Diallo").length).toBeGreaterThan(0);
    unmount();

    const grades = render(
      <GradesScreen
        api={failingApi}
        classes={[classroom]}
        initialReportCards={[reportCard]}
        onError={vi.fn()}
        onNotice={vi.fn()}
        periods={[period]}
        remoteEnabled={false}
        students={[student]}
        subjects={[subject]}
      />
    );
    expect(screen.getByRole("heading", { name: "Console notes & bulletins" })).toBeInTheDocument();
    expect(screen.getAllByText("Bon trimestre").length).toBeGreaterThan(0);
    grades.unmount();

    render(
      <FinanceScreen
        api={failingApi}
        defaultCurrency="XOF"
        initialData={financeData}
        levels={[level]}
        locale="fr-FR"
        onError={vi.fn()}
        onNotice={vi.fn()}
        remoteEnabled={false}
        schoolYears={[schoolYear]}
        students={[student]}
      />
    );

    expect(screen.getByRole("heading", { name: "Console de recouvrement" })).toBeInTheDocument();
    expect(screen.getAllByText("INV-2026-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CM2 A / Francophone").length).toBeGreaterThan(0);
  });

  it("charge les modules enseignants et salles depuis un client API mocke", async () => {
    const api = buildModuleApi();
    const commonProps = {
      classes: [classroom],
      cycles: [cycle],
      levels: [level],
      periods: [period],
      schoolYears: [schoolYear],
      subjects: [subject]
    };

    const teachers = render(
      <TeachersScreen
        {...commonProps}
        api={api}
        onError={vi.fn()}
        onNotice={vi.fn()}
        users={[] satisfies UserAccount[]}
      />
    );

    expect(await screen.findByText("Mamadou Ndiaye")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Module enseignants" })).toBeInTheDocument();
    teachers.unmount();

    render(
      <RoomsScreen
        {...commonProps}
        api={api}
        onError={vi.fn()}
        onNotice={vi.fn()}
      />
    );

    expect(await screen.findByText("Salle 101")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Salles, capacites et usages" })).toBeInTheDocument();
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/rooms");
    });
  });

  it("monte les portails parent et enseignant avec placements, notes et emploi du temps", () => {
    const parent = render(
      <PortalParentScreen
        api={failingApi}
        defaultCurrency="XOF"
        initialData={parentPortalData}
        locale="fr-FR"
        onError={vi.fn()}
        remoteEnabled={false}
      />
    );

    expect(screen.getByRole("heading", { name: "Portail parent metier" })).toBeInTheDocument();
    expect(screen.getByText(/Principal: Francophone/)).toBeInTheDocument();
    expect(screen.getAllByText("Mathematiques").length).toBeGreaterThan(0);
    parent.unmount();

    render(
      <PortalTeacherScreen
        api={failingApi}
        initialData={teacherPortalData}
        locale="fr-FR"
        onError={vi.fn()}
        onNotice={vi.fn()}
        periods={[period]}
        remoteEnabled={false}
        subjects={[subject]}
      />
    );

    expect(screen.getByRole("heading", { name: "Portail enseignant metier" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Actions metier" })).toBeInTheDocument();
    expect(screen.getAllByText("CM2 A (Francophone)").length).toBeGreaterThan(0);
  });
});
