import type { JSX } from "react";

import type { FieldErrors, PeriodStatus } from "../../../shared/types/app";

import {
  PERIOD_STATUS_OPTIONS,
  PERIOD_TYPE_OPTIONS,
} from "../../../shared/constants/domain";
import {
  fieldError,
  focusFirstInlineErrorField,
  formatPeriodTypeLabel,
  formatReferenceStatusLabel,
  formatSchoolYearOptionLabel,
  hasFieldErrors,
  renderFieldLabel
} from "../utils/reference-ui";
import { useReferenceScreenContext } from "./reference-screen-context";

export function PeriodsSection(): JSX.Element {
  const ctx = useReferenceScreenContext();
  const {
    createRef,
    defaultSchoolYearId,
    deleteRef,
    periodErrors,
    periodForm,
    periodParents,
    periods,
    periodYearFilter,
    schoolYearById,
    schoolYears,
    selectedPeriodSchoolYear,
    setPeriodErrors,
    setPeriodForm,
    setPeriodYearFilter,
    shownPeriods
  } = ctx;

  return (
<article id="reference-periods" data-step-id="periods" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Periode</h3>
                <p className="section-lead">
                  Decoupage pedagogique ou evaluatif de l'annee: trimestre, semestre, bimestre ou libre.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{periods.length} periode(s)</span>
                <span className="module-inline-pill">Dates bornees dans l'annee</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};

                  if (!periodForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
                  if (!periodForm.label.trim()) errors.label = "Nom de la periode requis.";
                  if (!periodForm.code.trim()) errors.code = "Code periode requis.";
                  if (!periodForm.startDate) errors.startDate = "Date de debut requise.";
                  if (!periodForm.endDate) errors.endDate = "Date de fin requise.";
                  if (!Number.isFinite(periodForm.sortOrder) || periodForm.sortOrder < 0) {
                    errors.sortOrder = "Ordre de periode invalide.";
                  }
                  if (!periodForm.status) errors.status = "Statut requis.";
                  if (periodForm.startDate && periodForm.endDate && periodForm.endDate <= periodForm.startDate) {
                    errors.endDate = "La date de fin doit etre strictement apres la date de debut.";
                  }
                  if (
                    selectedPeriodSchoolYear &&
                    periodForm.startDate &&
                    selectedPeriodSchoolYear.startDate &&
                    selectedPeriodSchoolYear.endDate &&
                    (periodForm.startDate < selectedPeriodSchoolYear.startDate || periodForm.startDate > selectedPeriodSchoolYear.endDate)
                  ) {
                    errors.startDate = "La date de debut doit rester dans l'annee scolaire choisie.";
                  }
                  if (
                    selectedPeriodSchoolYear &&
                    periodForm.endDate &&
                    selectedPeriodSchoolYear.startDate &&
                    selectedPeriodSchoolYear.endDate &&
                    (periodForm.endDate < selectedPeriodSchoolYear.startDate || periodForm.endDate > selectedPeriodSchoolYear.endDate)
                  ) {
                    errors.endDate = "La date de fin doit rester dans l'annee scolaire choisie.";
                  }
                  if (
                    periodForm.gradeEntryDeadline &&
                    (periodForm.gradeEntryDeadline < periodForm.startDate || periodForm.gradeEntryDeadline > periodForm.endDate)
                  ) {
                    errors.gradeEntryDeadline = "La date limite de saisie doit rester dans la periode.";
                  }
                  if (periodForm.lockDate && periodForm.startDate && periodForm.lockDate < periodForm.startDate) {
                    errors.lockDate = "La date de verrouillage ne peut pas etre avant le debut.";
                  }
                  if (periodForm.parentPeriodId) {
                    const parent = periods.find((item) => item.id === periodForm.parentPeriodId);
                    if (parent && parent.schoolYearId !== periodForm.schoolYearId) {
                      errors.parentPeriodId = "La periode parent doit appartenir a la meme annee scolaire.";
                    }
                  }

                  setPeriodErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("periods");
                    return;
                  }

                  void createRef(
                    "/academic-periods",
                    {
                      schoolYearId: periodForm.schoolYearId,
                      code: periodForm.code.trim(),
                      label: periodForm.label.trim(),
                      startDate: periodForm.startDate,
                      endDate: periodForm.endDate,
                      periodType: periodForm.periodType,
                      sortOrder: periodForm.sortOrder,
                      status: periodForm.status,
                      parentPeriodId: periodForm.parentPeriodId || undefined,
                      isGradeEntryOpen: periodForm.isGradeEntryOpen,
                      gradeEntryDeadline: periodForm.gradeEntryDeadline || undefined,
                      lockDate: periodForm.lockDate || undefined,
                      comment: periodForm.comment.trim() || undefined
                    },
                    "Periode creee."
                  ).then((ok) => {
                    if (ok) {
                      setPeriodErrors({});
                      setPeriodForm((prev) => ({
                        ...prev,
                        schoolYearId: prev.schoolYearId || defaultSchoolYearId,
                        code: "",
                        label: "",
                        startDate: "",
                        endDate: "",
                        periodType: "TRIMESTER",
                        sortOrder: 1,
                        status: "ACTIVE",
                        parentPeriodId: "",
                        isGradeEntryOpen: false,
                        gradeEntryDeadline: "",
                        lockDate: "",
                        comment: ""
                      }));
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Annee scolaire", { required: true })}
                  <select value={periodForm.schoolYearId} onChange={(event) => setPeriodForm((prev) => ({ ...prev, schoolYearId: event.target.value, parentPeriodId: "" }))}>
                    <option value="">Choisir</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                  {fieldError(periodErrors, "schoolYearId")}
                </label>
                <label>
                  {renderFieldLabel("Nom de la periode", { required: true })}
                  <input value={periodForm.label} onChange={(event) => setPeriodForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Trimestre 1" />
                  {fieldError(periodErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={periodForm.code} onChange={(event) => setPeriodForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="T1-2526" />
                  {fieldError(periodErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Date de debut", { required: true })}
                  <input type="date" value={periodForm.startDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, startDate: event.target.value }))} />
                  {fieldError(periodErrors, "startDate")}
                </label>
                <label>
                  {renderFieldLabel("Date de fin", { required: true })}
                  <input type="date" value={periodForm.endDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, endDate: event.target.value }))} />
                  {fieldError(periodErrors, "endDate")}
                </label>
                <label>
                  {renderFieldLabel("Type de periode", { required: true })}
                  <select value={periodForm.periodType} onChange={(event) => setPeriodForm((prev) => ({ ...prev, periodType: event.target.value }))}>
                    {PERIOD_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldError(periodErrors, "periodType")}
                </label>
                <label>
                  {renderFieldLabel("Ordre", { required: true })}
                  <input type="number" min={0} value={periodForm.sortOrder} onChange={(event) => setPeriodForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))} />
                  {fieldError(periodErrors, "sortOrder")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={periodForm.status} onChange={(event) => setPeriodForm((prev) => ({ ...prev, status: event.target.value as PeriodStatus }))}>
                    {PERIOD_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatReferenceStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(periodErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Periode parent")}
                  <select value={periodForm.parentPeriodId} onChange={(event) => setPeriodForm((prev) => ({ ...prev, parentPeriodId: event.target.value }))}>
                    <option value="">Aucune</option>
                    {periodParents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {fieldError(periodErrors, "parentPeriodId")}
                </label>
                <label>
                  {renderFieldLabel("Date limite de saisie des notes")}
                  <input type="date" value={periodForm.gradeEntryDeadline} onChange={(event) => setPeriodForm((prev) => ({ ...prev, gradeEntryDeadline: event.target.value }))} />
                  {fieldError(periodErrors, "gradeEntryDeadline")}
                </label>
                <label>
                  {renderFieldLabel("Date de verrouillage")}
                  <input type="date" value={periodForm.lockDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, lockDate: event.target.value }))} />
                  {fieldError(periodErrors, "lockDate")}
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Commentaire")}
                  <textarea value={periodForm.comment} onChange={(event) => setPeriodForm((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Consignes de saisie, verrouillage, mode de calcul..." />
                  {fieldError(periodErrors, "comment")}
                </label>
                <div className="reference-toggle-grid form-grid-span-full">
                  <label className="check-row reference-check-row">
                    <input type="checkbox" checked={periodForm.isGradeEntryOpen} onChange={(event) => setPeriodForm((prev) => ({ ...prev, isGradeEntryOpen: event.target.checked }))} />
                    Periode de saisie des notes ouverte
                  </label>
                </div>
                <div className="actions">
                  <button type="submit">Creer la periode</button>
                </div>
              </form>
            </div>
            <div className="filter-grid module-filter">
              <label>
                {renderFieldLabel("Filtre annee")}
                <select value={periodYearFilter} onChange={(event) => setPeriodYearFilter(event.target.value)}>
                  <option value="">Toutes les annees</option>
                  {schoolYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatSchoolYearOptionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Annee</th>
                    <th>Periode</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shownPeriods.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune periode pour le filtre courant.</td></tr>
                  ) : (
                    shownPeriods.map((item) => (
                      <tr key={item.id}>
                        <td>{formatSchoolYearOptionLabel(schoolYearById.get(item.schoolYearId))}</td>
                        <td>{item.label} ({item.code})</td>
                        <td>{formatPeriodTypeLabel(item.periodType)}</td>
                        <td>{item.startDate} au {item.endDate}</td>
                        <td>{formatReferenceStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/academic-periods/${item.id}`, "Periode supprimee.")}>
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
