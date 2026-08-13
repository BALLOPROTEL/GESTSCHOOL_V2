import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ClassItem,
  Enrollment,
  Invoice,
  Level,
  Period,
  RecoveryDashboard,
  ReportCard,
  SchoolYear,
  Student
} from "../../shared/types/app";
import { PilotageScreen } from "./pilotage-screen";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "matchMedia");
});

const schoolYear: SchoolYear = {
  id: "year-2026",
  code: "2025-2026",
  label: "Année 2025-2026",
  startDate: "2025-09-01",
  endDate: "2026-07-31",
  isActive: true,
  status: "ACTIVE"
};

const francophoneLevel: Level = {
  id: "level-cm2",
  cycleId: "cycle-primary",
  code: "CM2",
  label: "CM2",
  track: "FRANCOPHONE",
  status: "ACTIVE"
};

const arabophoneLevel: Level = {
  id: "level-ar",
  cycleId: "cycle-primary",
  code: "AR",
  label: "Arabe",
  track: "ARABOPHONE",
  status: "ACTIVE"
};

const classCm2: ClassItem = {
  id: "class-cm2",
  schoolYearId: schoolYear.id,
  levelId: francophoneLevel.id,
  code: "CM2-A",
  label: "CM2 A",
  track: "FRANCOPHONE",
  status: "ACTIVE"
};

const classAr: ClassItem = {
  id: "class-ar",
  schoolYearId: schoolYear.id,
  levelId: arabophoneLevel.id,
  code: "AR-A",
  label: "Arabe A",
  track: "ARABOPHONE",
  status: "ACTIVE"
};

const period: Period = {
  id: "period-t1",
  schoolYearId: schoolYear.id,
  code: "T1",
  label: "Trimestre 1",
  periodType: "TRIMESTER",
  startDate: "2025-09-01",
  endDate: "2025-12-15",
  status: "ACTIVE"
};

const studentWithClass: Student = {
  id: "student-1",
  tenantId: "tenant-1",
  matricule: "STD-001",
  firstName: "Awa",
  lastName: "Diallo",
  fullName: "Awa Diallo",
  sex: "F",
  status: "ACTIVE",
  tracks: ["FRANCOPHONE"],
  placements: [
    {
      placementId: "placement-1",
      track: "FRANCOPHONE",
      placementStatus: "ACTIVE",
      isPrimary: true,
      schoolYearId: schoolYear.id,
      levelId: francophoneLevel.id,
      classId: classCm2.id,
      classLabel: classCm2.label
    }
  ]
};

const studentWithoutClass: Student = {
  id: "student-2",
  tenantId: "tenant-1",
  matricule: "STD-002",
  firstName: "Moussa",
  lastName: "Ba",
  fullName: "Moussa Ba",
  sex: "M",
  status: "ACTIVE",
  tracks: ["FRANCOPHONE"],
  placements: [
    {
      placementId: "placement-2",
      track: "FRANCOPHONE",
      placementStatus: "ACTIVE",
      isPrimary: true,
      schoolYearId: schoolYear.id,
      levelId: francophoneLevel.id
    }
  ]
};

const enrollment: Enrollment = {
  id: "enrollment-1",
  schoolYearId: schoolYear.id,
  classId: classCm2.id,
  studentId: studentWithClass.id,
  track: "FRANCOPHONE",
  enrollmentDate: "2025-09-01",
  enrollmentStatus: "DRAFT",
  studentName: studentWithClass.fullName,
  classLabel: classCm2.label,
  schoolYearCode: schoolYear.code
};

const invoice: Invoice = {
  id: "invoice-1",
  studentId: studentWithClass.id,
  schoolYearId: schoolYear.id,
  invoiceNo: "INV-001",
  amountDue: 100000,
  amountPaid: 25000,
  remainingAmount: 75000,
  status: "PARTIAL",
  primaryTrack: "FRANCOPHONE",
  primaryClassId: classCm2.id,
  primaryLevelId: francophoneLevel.id
};

const reportCard: ReportCard = {
  id: "report-1",
  studentId: studentWithClass.id,
  classId: classCm2.id,
  placementId: "placement-1",
  track: "FRANCOPHONE",
  mode: "TRACK_SINGLE",
  academicPeriodId: period.id,
  averageGeneral: 15,
  generatedAt: "2026-01-10T08:00:00.000Z"
};

const recovery: RecoveryDashboard = {
  totals: {
    amountDue: 100000,
    amountPaid: 25000,
    remainingAmount: 75000,
    recoveryRatePercent: 25
  },
  invoices: {
    total: 1,
    open: 0,
    partial: 1,
    paid: 0,
    void: 0
  }
};

const renderPilotage = (onSelectScreen = vi.fn()) =>
  render(
    <PilotageScreen
      api={vi.fn()}
      students={[studentWithClass, studentWithoutClass]}
      enrollments={[enrollment]}
      classes={[classCm2, classAr]}
      levels={[francophoneLevel, arabophoneLevel]}
      schoolYears={[schoolYear]}
      periods={[period]}
      invoices={[invoice]}
      recovery={recovery}
      reportCards={[reportCard]}
      locale="fr-FR"
      remoteEnabled={false}
      formatMoney={(value) => `${value.toLocaleString("fr-FR")} F CFA`}
      onSelectScreen={onSelectScreen}
    />
  );

describe("PilotageScreen", () => {
  it("affiche les quatre blocs de pilotage sans dupliquer le tableau de bord", () => {
    renderPilotage();

    expect(screen.getByRole("heading", { name: "Pilotage" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /scolarité/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /vie scolaire/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /finance/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "À traiter en priorité" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Actions rapides de pilotage" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tableau de bord" })).not.toBeInTheDocument();
  });

  it("utilise les vraies données passées et affiche les métriques indisponibles sans inventer de chiffres", () => {
    renderPilotage();

    const scolarite = screen.getByRole("region", { name: /scolarité/i });
    expect(within(scolarite).getByLabelText("Élèves actifs : 2")).toBeInTheDocument();
    expect(within(scolarite).getByLabelText("Inscriptions : 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes saisies : Non disponible")).toBeInTheDocument();
    expect(screen.getByLabelText("Absences : Non disponible")).toBeInTheDocument();
    expect(screen.getByLabelText(/Total dû : 100.*F CFA/)).toBeInTheDocument();
  });

  it("filtre par classe et période puis calcule les alertes actionnables", () => {
    const onSelectScreen = vi.fn();
    renderPilotage(onSelectScreen);

    fireEvent.change(screen.getByLabelText("Classe"), { target: { value: classCm2.id } });
    fireEvent.change(screen.getByLabelText("Période"), { target: { value: period.id } });

    const scolarite = screen.getByRole("region", { name: /scolarité/i });
    expect(within(scolarite).getByLabelText("Élèves actifs : 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Bulletins générés : 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Traiter" }));
    fireEvent.click(screen.getByRole("button", { name: "Relancer" }));
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));
    fireEvent.click(screen.getByRole("button", { name: /Notes & bulletins/i }));

    expect(onSelectScreen).toHaveBeenCalledWith("enrollments");
    expect(onSelectScreen).toHaveBeenCalledWith("finance");
    expect(onSelectScreen).toHaveBeenCalledWith("grades");
  });

  it("réduit les domaines secondaires sur mobile sans perdre leur contenu", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string): MediaQueryList => ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }) as unknown as MediaQueryList)
    });

    renderPilotage();

    const schoolLife = screen.getByRole("region", { name: /vie scolaire/i });
    expect(within(schoolLife).getByRole("button", { name: "Afficher" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(within(schoolLife).queryByLabelText("Notes saisies : Non disponible")).not.toBeVisible();

    fireEvent.click(within(schoolLife).getByRole("button", { name: "Afficher" }));
    expect(within(schoolLife).getByLabelText("Notes saisies : Non disponible")).toBeVisible();
  });
});
