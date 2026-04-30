import type { JSX } from "react";

import type { FieldErrors, SubjectNature } from "../../../shared/types/app";

import {
  REFERENCE_STATUS_OPTIONS,
  SUBJECT_NATURE_OPTIONS
} from "../../../shared/constants/domain";
import {
  fieldError,
  focusFirstInlineErrorField,
  formatAcademicTrackLabel,
  formatReferenceStatusLabel,
  formatSubjectNatureLabel,
  hasFieldErrors,
  parseOptionalNumber,
  renderFieldLabel
} from "../utils/reference-ui";
import { useReferenceScreenContext } from "./reference-screen-context";

export function SubjectsSection(): JSX.Element {
  const ctx = useReferenceScreenContext();
  const {
    createRef,
    cycleById,
    cycles,
    deleteRef,
    formatSubjectCycles,
    formatSubjectLevels,
    levels,
    setSubjectCycleScope,
    setSubjectErrors,
    setSubjectForm,
    subjectAvailableLevels,
    subjectCycleScope,
    subjectErrors,
    subjectForm,
    subjects
  } = ctx;

  return (
<article id="reference-subjects" data-step-id="subjects" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Matiere</h3>
                <p className="section-lead">
                  Discipline enseignee, distincte de son affectation a une classe, de son enseignant et de son emploi du temps.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{subjects.length} matiere(s)</span>
                <span className="module-inline-pill">{subjectForm.levelIds.length} niveau(x) selectionne(s)</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const defaultCoefficient = parseOptionalNumber(subjectForm.defaultCoefficient);
                  const weeklyHours = parseOptionalNumber(subjectForm.weeklyHours);

                  if (!subjectForm.label.trim()) errors.label = "Nom de la matiere requis.";
                  if (!subjectForm.code.trim()) errors.code = "Code matiere requis.";
                  if (!subjectForm.status) errors.status = "Statut requis.";
                  if (!subjectForm.nature) errors.nature = "Nature de la matiere requise.";
                  if (subjectForm.defaultCoefficient.trim() && (defaultCoefficient === undefined || defaultCoefficient <= 0)) {
                    errors.defaultCoefficient = "Le coefficient doit etre strictement superieur a zero.";
                  }
                  if (subjectForm.weeklyHours.trim() && (weeklyHours === undefined || weeklyHours <= 0)) {
                    errors.weeklyHours = "Le volume horaire doit etre strictement superieur a zero.";
                  }

                  setSubjectErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("subjects");
                    return;
                  }

                  void createRef(
                    "/subjects",
                    {
                      code: subjectForm.code.trim(),
                      label: subjectForm.label.trim(),
                      status: subjectForm.status,
                      nature: subjectForm.nature,
                      shortLabel: subjectForm.shortLabel.trim() || undefined,
                      defaultCoefficient,
                      category: subjectForm.category.trim() || undefined,
                      description: subjectForm.description.trim() || undefined,
                      color: subjectForm.color || undefined,
                      weeklyHours,
                      isGraded: subjectForm.isGraded,
                      isOptional: subjectForm.isOptional,
                      levelIds: subjectForm.levelIds.length > 0 ? subjectForm.levelIds : undefined,
                      isArabic: subjectForm.nature === "ARABOPHONE"
                    },
                    "Matiere creee."
                  ).then((ok) => {
                    if (ok) {
                      setSubjectErrors({});
                      setSubjectForm((prev) => ({
                        ...prev,
                        code: "",
                        label: "",
                        status: "ACTIVE",
                        nature: "FRANCOPHONE",
                        shortLabel: "",
                        defaultCoefficient: "",
                        category: "",
                        description: "",
                        color: "#16a34a",
                        weeklyHours: "",
                        isGraded: true,
                        isOptional: false,
                        levelIds: []
                      }));
                      setSubjectCycleScope("");
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Nom de la matiere", { required: true })}
                  <input value={subjectForm.label} onChange={(event) => setSubjectForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Mathematiques" />
                  {fieldError(subjectErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={subjectForm.code} onChange={(event) => setSubjectForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="MATH" />
                  {fieldError(subjectErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={subjectForm.status} onChange={(event) => setSubjectForm((prev) => ({ ...prev, status: event.target.value as "ACTIVE" | "INACTIVE" }))}>
                    {REFERENCE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatReferenceStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(subjectErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Nature", { required: true })}
                  <select value={subjectForm.nature} onChange={(event) => setSubjectForm((prev) => ({ ...prev, nature: event.target.value as SubjectNature }))}>
                    {SUBJECT_NATURE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatSubjectNatureLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(subjectErrors, "nature")}
                </label>
                <label>
                  {renderFieldLabel("Libelle court")}
                  <input value={subjectForm.shortLabel} onChange={(event) => setSubjectForm((prev) => ({ ...prev, shortLabel: event.target.value }))} placeholder="Maths" />
                  {fieldError(subjectErrors, "shortLabel")}
                </label>
                <label>
                  {renderFieldLabel("Coefficient par defaut")}
                  <input type="number" min={0} step="0.1" value={subjectForm.defaultCoefficient} onChange={(event) => setSubjectForm((prev) => ({ ...prev, defaultCoefficient: event.target.value }))} placeholder="4" />
                  {fieldError(subjectErrors, "defaultCoefficient")}
                </label>
                <label>
                  {renderFieldLabel("Cycle concerne")}
                  <select
                    value={subjectCycleScope}
                    onChange={(event) => {
                      const nextCycleId = event.target.value;
                      const allowedLevelIds = nextCycleId
                        ? new Set(levels.filter((item) => item.cycleId === nextCycleId).map((item) => item.id))
                        : null;
                      setSubjectCycleScope(nextCycleId);
                      setSubjectForm((prev) => ({
                        ...prev,
                        levelIds: allowedLevelIds ? prev.levelIds.filter((levelId) => allowedLevelIds.has(levelId)) : prev.levelIds
                      }));
                    }}
                  >
                    <option value="">Tous les cycles</option>
                    {cycles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {renderFieldLabel("Categorie / groupe")}
                  <input value={subjectForm.category} onChange={(event) => setSubjectForm((prev) => ({ ...prev, category: event.target.value }))} placeholder="Scientifique" />
                  {fieldError(subjectErrors, "category")}
                </label>
                <label>
                  {renderFieldLabel("Couleur d'affichage")}
                  <input type="color" value={subjectForm.color} onChange={(event) => setSubjectForm((prev) => ({ ...prev, color: event.target.value }))} />
                  {fieldError(subjectErrors, "color")}
                </label>
                <label>
                  {renderFieldLabel("Volume horaire hebdomadaire")}
                  <input type="number" min={0} step="0.5" value={subjectForm.weeklyHours} onChange={(event) => setSubjectForm((prev) => ({ ...prev, weeklyHours: event.target.value }))} placeholder="4" />
                  {fieldError(subjectErrors, "weeklyHours")}
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Niveau(x) concerne(s)")}
                  <select
                    multiple
                    className="multi-select"
                    value={subjectForm.levelIds}
                    onChange={(event) =>
                      setSubjectForm((prev) => ({
                        ...prev,
                        levelIds: Array.from(event.target.selectedOptions).map((option) => option.value)
                      }))
                    }
                  >
                    {subjectAvailableLevels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {cycleById.get(item.cycleId)?.label || "-"} - {item.label} ({formatAcademicTrackLabel(item.track)})
                      </option>
                    ))}
                  </select>
                  {fieldError(subjectErrors, "levelIds")}
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Description")}
                  <textarea value={subjectForm.description} onChange={(event) => setSubjectForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Portee de la discipline, evaluation, obligations..." />
                  {fieldError(subjectErrors, "description")}
                </label>
                <div className="reference-toggle-grid form-grid-span-full">
                  <label className="check-row reference-check-row">
                    <input type="checkbox" checked={subjectForm.isGraded} onChange={(event) => setSubjectForm((prev) => ({ ...prev, isGraded: event.target.checked }))} />
                    Matiere notee
                  </label>
                  <label className="check-row reference-check-row">
                    <input type="checkbox" checked={subjectForm.isOptional} onChange={(event) => setSubjectForm((prev) => ({ ...prev, isOptional: event.target.checked }))} />
                    Matiere optionnelle
                  </label>
                </div>
                <div className="actions">
                  <button type="submit">Creer la matiere</button>
                </div>
              </form>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matiere</th>
                    <th>Nature</th>
                    <th>Cycles</th>
                    <th>Niveaux</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune matiere configuree.</td></tr>
                  ) : (
                    subjects.map((item) => (
                      <tr key={item.id}>
                        <td>{item.label} ({item.code})</td>
                        <td>{formatSubjectNatureLabel(item.nature)}</td>
                        <td>{formatSubjectCycles(item.levelIds)}</td>
                        <td>{formatSubjectLevels(item.levelIds)}</td>
                        <td>{formatReferenceStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/subjects/${item.id}`, "Matiere supprimee.")}>
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
