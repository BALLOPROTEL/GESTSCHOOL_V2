import type { JSX } from "react";

import type { AcademicStage, FieldErrors } from "../../../shared/types/app";
import { UI_MESSAGES } from "../../../shared/i18n";

import {
  REFERENCE_STATUS_OPTIONS
} from "../../../shared/constants/domain";
import {
  fieldError as renderReferenceFieldError,
  focusFirstInlineErrorField,
  formatAcademicStageLabel,
  formatReferenceStatusLabel,
  formatSchoolYearOptionLabel,
  hasFieldErrors,
  parseOptionalNumber,
  renderFieldLabel
} from "../utils/reference-ui";
import { ReferenceActionMenu } from "./reference-action-menu";
import { useReferenceScreenContext } from "./reference-screen-context";
import { useI18n } from "../../../shared/i18n-context";


export function CyclesSection(): JSX.Element {
  const { t: tr } = useI18n();
  const fieldError = (errors: FieldErrors, key: string) => renderReferenceFieldError(errors, key, tr);
  const ctx = useReferenceScreenContext();
  const {
    createRef,
    cycleErrors,
    cycleForm,
    cycles,
    defaultSchoolYearId,
    deleteRef,
    schoolFieldValue,
    schoolName,
    schoolYearById,
    schoolYears,
    setCycleErrors,
    setCycleForm
  } = ctx;
  const SCHOOL_NAME = schoolName;

  return (
<article id="reference-cycles" data-step-id="cycles" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>{tr("Cycle")}</h3>
                <p className="section-lead">
                  {tr("Grand regroupement pedagogique tel que Primaire, College ou Lycee. Il sert de base a\n                  plusieurs niveaux.")}</p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{cycles.length} {tr("cycle(s)")}</span>
                <span className="module-inline-pill">{tr("Ordre academique coherent")}</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const theoreticalAgeMin = parseOptionalNumber(cycleForm.theoreticalAgeMin);
                  const theoreticalAgeMax = parseOptionalNumber(cycleForm.theoreticalAgeMax);

                  if (!cycleForm.schoolYearId) errors.schoolYearId = UI_MESSAGES.fieldRequired;
                  if (!cycleForm.label.trim()) errors.label = UI_MESSAGES.fieldRequired;
                  if (!cycleForm.code.trim()) errors.code = UI_MESSAGES.fieldRequired;
                  if (!cycleForm.academicStage) errors.academicStage = UI_MESSAGES.fieldRequired;
                  if (!Number.isFinite(cycleForm.sortOrder) || cycleForm.sortOrder < 0) {
                    errors.sortOrder = UI_MESSAGES.fieldInvalid;
                  }
                  if (cycleForm.theoreticalAgeMin.trim() && theoreticalAgeMin === undefined) {
                    errors.theoreticalAgeMin = UI_MESSAGES.fieldInvalid;
                  }
                  if (cycleForm.theoreticalAgeMax.trim() && theoreticalAgeMax === undefined) {
                    errors.theoreticalAgeMax = UI_MESSAGES.fieldInvalid;
                  }
                  if (
                    theoreticalAgeMin !== undefined &&
                    theoreticalAgeMax !== undefined &&
                    theoreticalAgeMax < theoreticalAgeMin
                  ) {
                    errors.theoreticalAgeMax = UI_MESSAGES.fieldInvalid;
                  }

                  setCycleErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("cycles");
                    return;
                  }

                  void createRef(
                    "/cycles",
                    {
                      schoolYearId: cycleForm.schoolYearId,
                      code: cycleForm.code.trim(),
                      label: cycleForm.label.trim(),
                      academicStage: cycleForm.academicStage,
                      sortOrder: cycleForm.sortOrder,
                      description: cycleForm.description.trim() || undefined,
                      theoreticalAgeMin,
                      theoreticalAgeMax,
                      status: cycleForm.status
                    }
                  ).then((ok) => {
                    if (ok) {
                      setCycleErrors({});
                      setCycleForm((prev) => ({
                        ...prev,
                        schoolYearId: prev.schoolYearId || defaultSchoolYearId,
                        code: "",
                        label: "",
                        academicStage: "PRIMARY",
                        sortOrder: 1,
                        description: "",
                        theoreticalAgeMin: "",
                        theoreticalAgeMax: "",
                        status: "ACTIVE"
                      }));
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Annee scolaire", { required: true })}
                  <select value={cycleForm.schoolYearId} onChange={(event) => setCycleForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}>
                    <option value="">{tr("Choisir")}</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                  {fieldError(cycleErrors, "schoolYearId")}
                </label>
                <label>
                  {renderFieldLabel("Nom du cycle", { required: true })}
                  <input value={cycleForm.label} onChange={(event) => setCycleForm((prev) => ({ ...prev, label: event.target.value }))} placeholder={tr("Primaire")} />
                  {fieldError(cycleErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={cycleForm.code} onChange={(event) => setCycleForm((prev) => ({ ...prev, code: event.target.value }))} placeholder={tr("PRIM")} />
                  {fieldError(cycleErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Stade academique", { required: true })}
                  <select value={cycleForm.academicStage} onChange={(event) => setCycleForm((prev) => ({ ...prev, academicStage: event.target.value as AcademicStage }))}>
                    <option value="PRIMARY">{tr(formatAcademicStageLabel("PRIMARY"))}</option>
                    <option value="SECONDARY">{tr(formatAcademicStageLabel("SECONDARY"))}</option>
                    <option value="HIGHER">{tr(formatAcademicStageLabel("HIGHER"))}</option>
                  </select>
                  {fieldError(cycleErrors, "academicStage")}
                </label>
                <label>
                  {renderFieldLabel("Ordre academique", { required: true })}
                  <input type="number" min={0} value={cycleForm.sortOrder} onChange={(event) => setCycleForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))} />
                  {fieldError(cycleErrors, "sortOrder")}
                </label>
                <label>
                  {renderFieldLabel("Statut")}
                  <select value={cycleForm.status} onChange={(event) => setCycleForm((prev) => ({ ...prev, status: event.target.value as "ACTIVE" | "INACTIVE" }))}>
                    {REFERENCE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {tr(formatReferenceStatusLabel(option))}
                      </option>
                    ))}
                  </select>
                  {fieldError(cycleErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Age theorique min")}
                  <input type="number" min={0} value={cycleForm.theoreticalAgeMin} onChange={(event) => setCycleForm((prev) => ({ ...prev, theoreticalAgeMin: event.target.value }))} placeholder="6" />
                  {fieldError(cycleErrors, "theoreticalAgeMin")}
                </label>
                <label>
                  {renderFieldLabel("Age theorique max")}
                  <input type="number" min={0} value={cycleForm.theoreticalAgeMax} onChange={(event) => setCycleForm((prev) => ({ ...prev, theoreticalAgeMax: event.target.value }))} placeholder="11" />
                  {fieldError(cycleErrors, "theoreticalAgeMax")}
                </label>
                <label>
                  {renderFieldLabel("Etablissement")}
                  <select value={schoolFieldValue} onChange={() => undefined}>
                    <option value={schoolFieldValue}>{SCHOOL_NAME}</option>
                  </select>
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Description")}
                  <textarea value={cycleForm.description} onChange={(event) => setCycleForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={tr("Grand regroupement pedagogique et contraintes de pilotage...")} />
                  {fieldError(cycleErrors, "description")}
                </label>
                <div className="actions">
                  <button type="submit">{tr("Creer le cycle")}</button>
                </div>
              </form>
            </div>
            <div className="table-wrap">
              <table data-responsive-table="true">
                <thead>
                  <tr>
                    <th>{tr("Annee")}</th>
                    <th>{tr("Cycle")}</th>
                    <th>{tr("Stade")}</th>
                    <th>{tr("Ordre")}</th>
                    <th>{tr("Statut")}</th>
                    <th>{tr("Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">{tr("Aucun cycle configure.")}</td></tr>
                  ) : (
                    cycles.map((item) => (
                      <tr key={item.id}>
                        <td data-label={tr("Annee")}>{item.schoolYearId ? formatSchoolYearOptionLabel(schoolYearById.get(item.schoolYearId)) : "-"}</td>
                        <td data-label={tr("Cycle")}>{item.label} ({item.code})</td>
                        <td data-label={tr("Stade")}>{tr(formatAcademicStageLabel(item.academicStage))}</td>
                        <td data-label={tr("Ordre")}>{item.sortOrder}</td>
                        <td data-label={tr("Statut")}>{tr(formatReferenceStatusLabel(item.status))}</td>
                        <td data-label={tr("Action")}>
                          <ReferenceActionMenu
                            label={`Options cycle ${item.label}`}
                            onDelete={() => void deleteRef(`/cycles/${item.id}`)}
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
