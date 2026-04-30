import type { JSX } from "react";

import type { FieldErrors, SchoolYearStatus } from "../../../shared/types/app";

import {
  SCHOOL_YEAR_STATUS_OPTIONS
} from "../../../shared/constants/domain";
import {
  fieldError,
  focusFirstInlineErrorField,
  formatSchoolYearOptionLabel,
  formatSchoolYearStatusLabel,
  hasFieldErrors,
  parseOptionalNumber,
  renderFieldLabel
} from "../utils/reference-ui";
import { useReferenceScreenContext } from "./reference-screen-context";

export function SchoolYearsSection(): JSX.Element {
  const ctx = useReferenceScreenContext();
  const {
    activeSchoolYear,
    createRef,
    deleteRef,
    schoolFieldValue,
    schoolName,
    schoolYearById,
    schoolYearErrors,
    schoolYears,
    setSchoolYearErrors,
    setSyForm,
    syForm
  } = ctx;
  const SCHOOL_NAME = schoolName;

  return (
<article id="reference-years" data-step-id="years" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Annee scolaire</h3>
                <p className="section-lead">
                  Base temporelle de tout le logiciel. Une seule annee peut etre active a la fois pour
                  {` ${SCHOOL_NAME}`}.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{activeSchoolYear ? `Active: ${formatSchoolYearOptionLabel(activeSchoolYear)}` : "Aucune active"}</span>
                <span className="module-inline-pill">Libelle unique par etablissement</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const sortOrder = parseOptionalNumber(syForm.sortOrder);

                  if (!syForm.label.trim()) errors.label = "Libelle de l'annee requis.";
                  if (!syForm.startDate) errors.startDate = "Date de debut requise.";
                  if (!syForm.endDate) errors.endDate = "Date de fin requise.";
                  if (!syForm.status) errors.status = "Statut requis.";
                  if (syForm.startDate && syForm.endDate && syForm.endDate <= syForm.startDate) {
                    errors.endDate = "La date de fin doit etre strictement apres la date de debut.";
                  }
                  if (syForm.sortOrder.trim() && sortOrder === undefined) {
                    errors.sortOrder = "Ordre / rang invalide.";
                  }
                  if (syForm.previousYearId) {
                    const previousYear = schoolYearById.get(syForm.previousYearId);
                    if (previousYear?.endDate && syForm.startDate && previousYear.endDate >= syForm.startDate) {
                      errors.previousYearId = "L'annee precedente doit se terminer avant la nouvelle annee.";
                    }
                  }

                  setSchoolYearErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("years");
                    return;
                  }

                  void createRef(
                    "/school-years",
                    {
                      code: syForm.code.trim() || undefined,
                      label: syForm.label.trim(),
                      startDate: syForm.startDate,
                      endDate: syForm.endDate,
                      status: syForm.status,
                      previousYearId: syForm.previousYearId || undefined,
                      isDefault: syForm.isDefault,
                      sortOrder,
                      comment: syForm.comment.trim() || undefined,
                      isActive: syForm.status === "ACTIVE"
                    },
                    "Annee scolaire creee."
                  ).then((ok) => {
                    if (ok) {
                      setSchoolYearErrors({});
                      setSyForm({
                        code: "",
                        label: "",
                        startDate: "",
                        endDate: "",
                        status: "DRAFT",
                        previousYearId: "",
                        isDefault: false,
                        sortOrder: "",
                        comment: ""
                      });
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Libelle de l'annee scolaire", { required: true })}
                  <input value={syForm.label} onChange={(event) => setSyForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="2025-2026" />
                  {fieldError(schoolYearErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Date de debut", { required: true })}
                  <input type="date" value={syForm.startDate} onChange={(event) => setSyForm((prev) => ({ ...prev, startDate: event.target.value }))} />
                  {fieldError(schoolYearErrors, "startDate")}
                </label>
                <label>
                  {renderFieldLabel("Date de fin", { required: true })}
                  <input type="date" value={syForm.endDate} onChange={(event) => setSyForm((prev) => ({ ...prev, endDate: event.target.value }))} />
                  {fieldError(schoolYearErrors, "endDate")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={syForm.status} onChange={(event) => setSyForm((prev) => ({ ...prev, status: event.target.value as SchoolYearStatus }))}>
                    {SCHOOL_YEAR_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatSchoolYearStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(schoolYearErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Code")}
                  <input value={syForm.code} onChange={(event) => setSyForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="AS-2025-2026" />
                  {fieldError(schoolYearErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Annee precedente liee")}
                  <select value={syForm.previousYearId} onChange={(event) => setSyForm((prev) => ({ ...prev, previousYearId: event.target.value }))}>
                    <option value="">Aucune</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                  {fieldError(schoolYearErrors, "previousYearId")}
                </label>
                <label>
                  {renderFieldLabel("Etablissement")}
                  <select value={schoolFieldValue} onChange={() => undefined}>
                    <option value={schoolFieldValue}>{SCHOOL_NAME}</option>
                  </select>
                </label>
                <label>
                  {renderFieldLabel("Ordre / rang")}
                  <input type="number" min={0} value={syForm.sortOrder} onChange={(event) => setSyForm((prev) => ({ ...prev, sortOrder: event.target.value }))} placeholder="2025" />
                  {fieldError(schoolYearErrors, "sortOrder")}
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Commentaire")}
                  <textarea value={syForm.comment} onChange={(event) => setSyForm((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Notes de cadrage, reconduction, decisions..." />
                  {fieldError(schoolYearErrors, "comment")}
                </label>
                <div className="reference-toggle-grid form-grid-span-full">
                  <label className="check-row reference-check-row">
                    <input type="checkbox" checked={syForm.isDefault} onChange={(event) => setSyForm((prev) => ({ ...prev, isDefault: event.target.checked }))} />
                    Annee par defaut pour les nouveaux ecrans et workflows
                  </label>
                </div>
                <div className="actions">
                  <button type="submit">Creer l'annee scolaire</button>
                </div>
              </form>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Libelle</th>
                    <th>Code</th>
                    <th>Dates</th>
                    <th>Statut</th>
                    <th>Options</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolYears.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">Aucune annee scolaire pour le moment.</td></tr>
                  ) : (
                    schoolYears.map((item) => (
                      <tr key={item.id}>
                        <td>{item.label || item.code}</td>
                        <td>{item.code}</td>
                        <td>{item.startDate} au {item.endDate}</td>
                        <td>{formatSchoolYearStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/school-years/${item.id}`, "Annee scolaire supprimee.")}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
  );
}
