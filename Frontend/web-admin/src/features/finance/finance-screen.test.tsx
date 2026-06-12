import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { translateUiString } from "../../shared/i18n";
import type {
  FeePlan,
  Invoice,
  Level,
  PaymentRecord,
  RecoveryDashboard,
  SchoolYear,
  Student
} from "../../shared/types/app";
import { FinanceScreen } from "./finance-screen";
import type { FinanceData } from "./types/finance";

afterEach(() => {
  cleanup();
});

const failingApi = vi.fn(async () => new Response(null, { status: 500 }));

const schoolYear: SchoolYear = {
  id: "year-1",
  code: "AS-2025-2026",
  label: "Année 2025-2026",
  isActive: true,
  status: "ACTIVE"
};

const level: Level = {
  id: "level-1",
  cycleId: "cycle-1",
  code: "CM2",
  label: "CM2",
  track: "FRANCOPHONE",
  status: "ACTIVE"
};

const student: Student = {
  id: "student-1",
  matricule: "GS-2025-001",
  firstName: "Aicha",
  lastName: "Diallo",
  fullName: "Aicha Diallo",
  sex: "F",
  status: "ACTIVE"
};

const feePlan: FeePlan = {
  id: "fee-plan-1",
  schoolYearId: schoolYear.id,
  levelId: level.id,
  label: "Frais CM2",
  totalAmount: 185000,
  currency: "CFA"
};

const partialInvoice: Invoice = {
  id: "invoice-1",
  studentId: student.id,
  schoolYearId: schoolYear.id,
  feePlanId: feePlan.id,
  invoiceNo: "FAC-001",
  amountDue: 185000,
  amountPaid: 100000,
  remainingAmount: 85000,
  status: "PARTIAL",
  dueDate: "2026-05-30",
  studentName: "Aicha Diallo",
  schoolYearCode: schoolYear.code,
  feePlanLabel: feePlan.label,
  primaryTrack: "FRANCOPHONE",
  primaryClassLabel: "CM2 A"
};

const paidInvoice: Invoice = {
  ...partialInvoice,
  id: "invoice-2",
  invoiceNo: "FAC-002",
  amountDue: 240000,
  amountPaid: 240000,
  remainingAmount: 0,
  status: "PAID"
};

const payment: PaymentRecord = {
  id: "payment-1",
  invoiceId: partialInvoice.id,
  invoiceNo: partialInvoice.invoiceNo,
  studentId: student.id,
  studentName: "Aicha Diallo",
  schoolYearId: schoolYear.id,
  receiptNo: "REC-001",
  paidAmount: 100000,
  paymentMethod: "CASH",
  paidAt: "2026-05-18T09:30:00.000Z",
  referenceExternal: "CAISSE-01"
};

const recovery: RecoveryDashboard = {
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
};

const financeData: FinanceData = {
  feePlans: [feePlan],
  invoices: [partialInvoice, paidInvoice],
  payments: [payment],
  recovery
};

const renderFinance = () =>
  render(
    <FinanceScreen
      api={failingApi}
      defaultCurrency="CFA"
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

describe("FinanceScreen", () => {
  it("présente les quatre onglets métier et les KPI de recouvrement", () => {
    renderFinance();

    expect(screen.getByRole("tab", { name: "Pilotage" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Plans de frais" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Factures" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Paiements" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Console de recouvrement" })).toBeInTheDocument();
    expect(screen.getByText("Total facturé")).toBeInTheDocument();
    expect(screen.getAllByText("Montant encaissé").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reste à recouvrer").length).toBeGreaterThan(0);
  });

  it("affiche les champs obligatoires des plans, factures et paiements", async () => {
    const user = userEvent.setup();
    renderFinance();

    await user.click(screen.getByRole("tab", { name: "Plans de frais" }));
    for (const label of ["Année scolaire *", "Niveau *", "Libellé *", "Montant total *", "Devise *"]) {
      expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("button", { name: "Créer le plan de frais" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Factures" }));
    for (const label of ["Élève *", "Année scolaire *", "Date d’échéance *"]) {
      expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("button", { name: "Créer la facture" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Paiements" }));
    for (const label of ["Facture *", "Montant versé *", "Mode de paiement *", "Date de paiement *"]) {
      expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("button", { name: "Enregistrer le paiement" })).toBeInTheDocument();
  });

  it("n'affiche pas de suppression directe ni de statuts techniques", async () => {
    const user = userEvent.setup();
    renderFinance();

    await user.click(screen.getByRole("tab", { name: "Factures" }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("Partiellement payée")).toBeInTheDocument();
    expect(within(table).getByText("Payée")).toBeInTheDocument();
    expect(screen.queryByText("PARTIAL")).not.toBeInTheDocument();
    expect(screen.queryByText("PAID")).not.toBeInTheDocument();
    expect(screen.queryByText("Supprimer")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Plans de frais" }));
    expect(screen.queryByText("Supprimer")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Informations plan Frais CM2" }));
    expect(screen.getByText((content) => content.includes("2 facture(s) liée(s)"))).toBeInTheDocument();
  });

  it("ne prétend pas générer un PDF en mode aperçu local", async () => {
    const user = userEvent.setup();
    renderFinance();

    await user.click(screen.getByRole("tab", { name: "Paiements" }));

    expect(screen.queryByRole("button", { name: "Reçu en PDF" })).not.toBeInTheDocument();
    expect(screen.getByText("PDF non disponible en aperçu")).toBeInTheDocument();
  });

  it("couvre les libellés critiques comptabilité en EN et AR", () => {
    const criticalSources = [
      "Console de recouvrement",
      "Total dû",
      "Montant encaissé",
      "Reste à recouvrer",
      "Taux de recouvrement",
      "Créer le plan de frais",
      "Créer la facture",
      "Enregistrer le paiement",
      "Reçu en PDF",
      "Partiellement payée",
      "Payée",
      "En retard",
      "Annulée",
      "Paiement en ligne PayDunya",
      "PDF non disponible en aperçu"
    ];

    for (const source of criticalSources) {
      expect(translateUiString("fr", source)).toBe(source);
      expect(translateUiString("en", source)).not.toBe(source);
      expect(translateUiString("ar", source)).not.toBe(source);
    }
  });
});
