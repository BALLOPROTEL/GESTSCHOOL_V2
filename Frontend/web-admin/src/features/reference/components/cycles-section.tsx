import type { JSX } from "react";

import type { AcademicStage, FieldErrors } from "../../../shared/types/app";

import {
  REFERENCE_STATUS_OPTIONS
} from "../../../shared/constants/domain";
import {
  fieldError,
  focusFirstInlineErrorField,
  formatAcademicStageLabel,
  formatReferenceStatusLabel,
  formatSchoolYearOptionLabel,
  hasFieldErrors,
  parseOptionalNumber,
  renderFieldLabel
} from "../utils/reference-ui";
import { useReferenceScreenContext } from "./reference-screen-context";

export function CyclesSection(): JSX.Element {
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
                <h3>Cycle</h3>
                <p className="section-lead">
                  Grand regroupement pedagogique tel que Primaire, College ou Lycee. Il sert de base a
                  plusieurs niveaux.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{cycles.length} cycle(s)</span>
                <span className="module-inline-pill">Ordre academique coherent</span>
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

                  if (!cycleForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
                  if (!cycleForm.label.trim()) errors.label = "Nom du cycle requis.";
                  if (!cycleForm.code.trim()) errors.code = "Code cycle requis.";
                  if (!cycleForm.academicStage) errors.academicStage = "Stade academique requis.";
                  if (!Number.isFinite(cycleForm.sortOrder) || cycleForm.sortOrder < 0) {
                    errors.sortOrder = "Ordre academique invalide.";
                  }
                  if (cycleForm.theoreticalAgeMin.trim() && theoreticalAgeMin === undefined) {
                    errors.theoreticalAgeMin = "Age theorique min invalide.";
                  }
                  if (cycleForm.theoreticalAgeMax.trim() && theoreticalAgeMax === undefined) {
                    errors.theoreticalAgeMax = "Age theorique max invalide.";
                  }
                  if (
                    theoreticalAgeMin !== undefined &&
                    theoreticalAgeMax !== undefined &&
                    theoreticalAgeMax < theoreticalAgeMin
                  ) {
                    errors.theoreticalAgeMax = "L'age theorique max doit etre superieur ou egal au min.";
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
                    },
                    "Cycle cree."
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
                    <option value="">Choisir</option>
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
                  <input value={cycleForm.label} onChange={(event) => setCycleForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Primaire" />
                  {fieldError(cycleErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={cycleForm.code} onChange={(event) => setCycleForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="PRIM" />
                  {fieldError(cycleErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Stade academique", { required: true })}
                  <select value={cycleForm.academicStage} onChange={(event) => setCycleForm((prev) => ({ ...prev, academicStage: event.target.value as AcademicStage }))}>
                    <option value="PRIMARY">{formatAcademicStageLabel("PRIMARY")}</option>
                    <option value="SECONDARY">{formatAcademicStageLabel("SECONDARY")}</option>
                    <option value="HIGHER">{formatAcademicStageLabel("HIGHER")}</option>
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
                        {formatReferenceStatusLabel(option)}
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
                  <textarea value={cycleForm.description} onChange={(event) => setCycleForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Grand regroupement pedagogique et contraintes de pilotage..." />
                  {fieldError(cycleErrors, "description")}
                </label>
                <div className="actions">
                  <button type="submit">Creer le cycle</button>
                </div>
              </form>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Annee</th>
                    <th>Cycle</th>
                    <th>Stade</th>
                    <th>Ordre</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucun cycle configure.</td></tr>
                  ) : (
                    cycles.map((item) => (
                      <tr key={item.id}>
                        <td>{item.schoolYearId ? formatSchoolYearOptionLabel(schoolYearById.get(item.schoolYearId)) : "-"}</td>
                        <td>{item.label} ({item.code})</td>
                        <td>{formatAcademicStageLabel(item.academicStage)}</td>
                        <td>{item.sortOrder}</td>
                        <td>{formatReferenceStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/cycles/${item.id}`, "Cycle supprime.")}>
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
