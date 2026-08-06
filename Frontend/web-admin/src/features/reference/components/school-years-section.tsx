import type { JSX } from "react";

import type { FieldErrors, SchoolYearStatus } from "../../../shared/types/app";
import { UI_MESSAGES } from "../../../shared/i18n";

import {
  SCHOOL_YEAR_STATUS_OPTIONS
} from "../../../shared/constants/domain";
import {
  fieldError as renderReferenceFieldError,
  focusFirstInlineErrorField,
  formatSchoolYearOptionLabel,
  formatSchoolYearStatusLabel,
  hasFieldErrors,
  parseOptionalNumber,
  renderFieldLabel
} from "../utils/reference-ui";
import { ReferenceActionMenu } from "./reference-action-menu";
import { useReferenceScreenContext } from "./reference-screen-context";
import { useI18n } from "../../../shared/i18n-context";


export function SchoolYearsSection(): JSX.Element {
  const { t: tr } = useI18n();
  const fieldError = (errors: FieldErrors, key: string) => renderReferenceFieldError(errors, key, tr);
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
                <h3>{tr("Annee scolaire")}</h3>
                <p className="section-lead">
                  {tr("Base temporelle de tout le logiciel. Une seule annee peut etre active a la fois pour")}{` ${SCHOOL_NAME}`}.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{activeSchoolYear ? tr(`Active: ${formatSchoolYearOptionLabel(activeSchoolYear)}`) : tr("Aucune active")}</span>
                <span className="module-inline-pill">{tr("Libelle unique par etablissement")}</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const sortOrder = parseOptionalNumber(syForm.sortOrder);

                  if (!syForm.label.trim()) errors.label = UI_MESSAGES.fieldRequired;
                  if (!syForm.startDate) errors.startDate = UI_MESSAGES.fieldRequired;
                  if (!syForm.endDate) errors.endDate = UI_MESSAGES.fieldRequired;
                  if (!syForm.status) errors.status = UI_MESSAGES.fieldRequired;
                  if (syForm.startDate && syForm.endDate && syForm.endDate <= syForm.startDate) {
                    errors.endDate = UI_MESSAGES.fieldInvalid;
                  }
                  if (syForm.sortOrder.trim() && sortOrder === undefined) {
                    errors.sortOrder = UI_MESSAGES.fieldInvalid;
                  }
                  if (syForm.previousYearId) {
                    const previousYear = schoolYearById.get(syForm.previousYearId);
                    if (previousYear?.endDate && syForm.startDate && previousYear.endDate >= syForm.startDate) {
                      errors.previousYearId = UI_MESSAGES.fieldInvalid;
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
                    }
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
                        {tr(formatSchoolYearStatusLabel(option))}
                      </option>
                    ))}
                  </select>
                  {fieldError(schoolYearErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Code")}
                  <input value={syForm.code} onChange={(event) => setSyForm((prev) => ({ ...prev, code: event.target.value }))} placeholder={tr("AS-2025-2026")} />
                  {fieldError(schoolYearErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Annee precedente liee")}
                  <select value={syForm.previousYearId} onChange={(event) => setSyForm((prev) => ({ ...prev, previousYearId: event.target.value }))}>
                    <option value="">{tr("Aucune")}</option>
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
                  <textarea value={syForm.comment} onChange={(event) => setSyForm((prev) => ({ ...prev, comment: event.target.value }))} placeholder={tr("Notes de cadrage, reconduction, decisions...")} />
                  {fieldError(schoolYearErrors, "comment")}
                </label>
                <div className="reference-toggle-grid form-grid-span-full">
                  <label className="check-row reference-check-row">
                    <input type="checkbox" checked={syForm.isDefault} onChange={(event) => setSyForm((prev) => ({ ...prev, isDefault: event.target.checked }))} />
                    {tr("Annee par defaut pour les nouveaux ecrans et workflows")}</label>
                </div>
                <div className="actions">
                  <button type="submit">{tr("Creer l'annee scolaire")}</button>
                </div>
              </form>
            </div>
            <div className="table-wrap">
              <table data-responsive-table="true">
                <thead>
                  <tr>
                    <th>{tr("Libelle")}</th>
                    <th>{tr("Code")}</th>
                    <th>{tr("Dates")}</th>
                    <th>{tr("Statut")}</th>
                    <th>{tr("Options")}</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolYears.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">{tr("Aucune annee scolaire pour le moment.")}</td></tr>
                  ) : (
                    schoolYears.map((item) => (
                      <tr key={item.id}>
                        <td data-label={tr("Libelle")}>{item.label || item.code}</td>
                        <td data-label={tr("Code")}>{item.code}</td>
                        <td data-label={tr("Dates")}>{item.startDate} {tr("au ")}{item.endDate}</td>
                        <td data-label={tr("Statut")}>{tr(formatSchoolYearStatusLabel(item.status))}</td>
                        <td data-label={tr("Options")}>
                          <ReferenceActionMenu
                            label={`Options annee scolaire ${item.label || item.code}`}
                            onDelete={() => void deleteRef(`/school-years/${item.id}`)}
                          />
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
