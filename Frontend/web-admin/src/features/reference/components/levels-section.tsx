import type { JSX } from "react";

import type { AcademicTrack, FieldErrors } from "../../../shared/types/app";
import { UI_MESSAGES } from "../../../shared/i18n";

import {
  ACADEMIC_TRACK_OPTIONS,
  REFERENCE_STATUS_OPTIONS,
} from "../../../shared/constants/domain";
import {
  fieldError as renderReferenceFieldError,
  focusFirstInlineErrorField,
  formatAcademicTrackLabel,
  formatReferenceStatusLabel,
  formatSchoolYearOptionLabel,
  hasFieldErrors,
  parseOptionalNumber,
  renderFieldLabel
} from "../utils/reference-ui";
import { ReferenceActionMenu } from "./reference-action-menu";
import { useReferenceScreenContext } from "./reference-screen-context";
import { useI18n } from "../../../shared/i18n-context";
import { ResponsiveForm } from "../../../shared/components/responsive-form";
import { ResponsiveDataTable } from "../../../shared/components/responsive-data-table";
import { ResponsiveFilterPanel } from "../../../shared/components/responsive-filter-panel";


export function LevelsSection(): JSX.Element {
  const { t: tr } = useI18n();
  const fieldError = (errors: FieldErrors, key: string) => renderReferenceFieldError(errors, key, tr);
  const ctx = useReferenceScreenContext();
  const {
    createRef,
    cycleById,
    cycles,
    deleteRef,
    levelCycleFilter,
    levelErrors,
    levelForm,
    levels,
    schoolYearById,
    schoolYears,
    selectedLevelSchoolYearId,
    setLevelCycleFilter,
    setLevelErrors,
    setLevelForm,
    shownLevels
  } = ctx;

  return (
<article id="reference-levels" data-step-id="levels" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>{tr("Niveau")}</h3>
                <p className="section-lead">
                  {tr("Classe pedagogique abstraite telle que CP1, 6e ou Terminale. Il ne faut pas la confondre\n                  avec la classe reelle d'affectation.")}</p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{levels.length} {tr("niveau(x)")}</span>
                <span className="module-inline-pill">{shownLevels.length} {tr("visible(s) avec le filtre")}</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <ResponsiveForm
                formTitle={tr("Ajouter un niveau")}
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const theoreticalAge = parseOptionalNumber(levelForm.theoreticalAge);

                  if (!levelForm.cycleId) errors.cycleId = UI_MESSAGES.fieldRequired;
                  if (!levelForm.label.trim()) errors.label = UI_MESSAGES.fieldRequired;
                  if (!levelForm.code.trim()) errors.code = UI_MESSAGES.fieldRequired;
                  if (!levelForm.track) errors.track = UI_MESSAGES.fieldRequired;
                  if (!levelForm.status) errors.status = UI_MESSAGES.fieldRequired;
                  if (!Number.isFinite(levelForm.sortOrder) || levelForm.sortOrder < 0) {
                    errors.sortOrder = UI_MESSAGES.fieldInvalid;
                  }
                  if (levelForm.theoreticalAge.trim() && theoreticalAge === undefined) {
                    errors.theoreticalAge = UI_MESSAGES.fieldInvalid;
                  }

                  setLevelErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("levels");
                    return;
                  }

                  void createRef(
                    "/levels",
                    {
                      cycleId: levelForm.cycleId,
                      code: levelForm.code.trim(),
                      label: levelForm.label.trim(),
                      sortOrder: levelForm.sortOrder,
                      track: levelForm.track,
                      alias: levelForm.alias.trim() || undefined,
                      status: levelForm.status,
                      theoreticalAge,
                      description: levelForm.description.trim() || undefined,
                      defaultSection: levelForm.defaultSection.trim() || undefined
                    }
                  ).then((ok) => {
                    if (ok) {
                      setLevelErrors({});
                      setLevelForm((prev) => ({
                        ...prev,
                        code: "",
                        label: "",
                        sortOrder: 1,
                        alias: "",
                        theoreticalAge: "",
                        description: "",
                        defaultSection: ""
                      }));
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Cycle de rattachement", { required: true })}
                  <select value={levelForm.cycleId} onChange={(event) => setLevelForm((prev) => ({ ...prev, cycleId: event.target.value }))}>
                    <option value="">{tr("Choisir")}</option>
                    {cycles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} - {item.schoolYearId ? formatSchoolYearOptionLabel(schoolYearById.get(item.schoolYearId)) : "-"}
                      </option>
                    ))}
                  </select>
                  {fieldError(levelErrors, "cycleId")}
                </label>
                <label>
                  {renderFieldLabel("Nom du niveau", { required: true })}
                  <input value={levelForm.label} onChange={(event) => setLevelForm((prev) => ({ ...prev, label: event.target.value }))} placeholder={tr("6e")} />
                  {fieldError(levelErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={levelForm.code} onChange={(event) => setLevelForm((prev) => ({ ...prev, code: event.target.value }))} placeholder={tr("6E")} />
                  {fieldError(levelErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Ordre", { required: true })}
                  <input type="number" min={0} value={levelForm.sortOrder} onChange={(event) => setLevelForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))} />
                  {fieldError(levelErrors, "sortOrder")}
                </label>
                <label>
                  {renderFieldLabel("Cursus", { required: true })}
                  <select value={levelForm.track} onChange={(event) => setLevelForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))}>
                    {ACADEMIC_TRACK_OPTIONS.map((track) => (
                      <option key={track} value={track}>
                        {tr(formatAcademicTrackLabel(track))}
                      </option>
                    ))}
                  </select>
                  {fieldError(levelErrors, "track")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={levelForm.status} onChange={(event) => setLevelForm((prev) => ({ ...prev, status: event.target.value as "ACTIVE" | "INACTIVE" }))}>
                    {REFERENCE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {tr(formatReferenceStatusLabel(option))}
                      </option>
                    ))}
                  </select>
                  {fieldError(levelErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Alias / libelle court")}
                  <input value={levelForm.alias} onChange={(event) => setLevelForm((prev) => ({ ...prev, alias: event.target.value }))} placeholder={tr("Sixieme")} />
                  {fieldError(levelErrors, "alias")}
                </label>
                <label>
                  {renderFieldLabel("Age theorique")}
                  <input type="number" min={0} value={levelForm.theoreticalAge} onChange={(event) => setLevelForm((prev) => ({ ...prev, theoreticalAge: event.target.value }))} placeholder="11" />
                  {fieldError(levelErrors, "theoreticalAge")}
                </label>
                <label>
                  {renderFieldLabel("Section / filiere par defaut")}
                  <input value={levelForm.defaultSection} onChange={(event) => setLevelForm((prev) => ({ ...prev, defaultSection: event.target.value }))} placeholder={tr("General")} />
                  {fieldError(levelErrors, "defaultSection")}
                </label>
                <label>
                  {renderFieldLabel("Annee scolaire")}
                  <select className="reference-derived-select" value={selectedLevelSchoolYearId} disabled>
                    {selectedLevelSchoolYearId ? null : <option value="">{tr("Aucune annee scolaire")}</option>}
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Description")}
                  <textarea value={levelForm.description} onChange={(event) => setLevelForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={tr("Positionnement du niveau, attentes, passerelles...")} />
                  {fieldError(levelErrors, "description")}
                </label>
                <div className="actions">
                  <button type="submit">{tr("Creer le niveau")}</button>
                </div>
              </ResponsiveForm>
            </div>
            <ResponsiveFilterPanel className="filter-grid module-filter" title={tr("Filtre cycle")} activeCount={levelCycleFilter ? 1 : 0}>
              <label>
                {renderFieldLabel("Filtre cycle")}
                <select value={levelCycleFilter} onChange={(event) => setLevelCycleFilter(event.target.value)}>
                  <option value="">{tr("Tous les cycles")}</option>
                  {cycles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </ResponsiveFilterPanel>
            <ResponsiveDataTable className="table-wrap">
              <table data-responsive-table="true">
                <thead>
                  <tr>
                    <th>{tr("Cycle")}</th>
                    <th>{tr("Niveau")}</th>
                    <th>{tr("Cursus")}</th>
                    <th>{tr("Ordre")}</th>
                    <th>{tr("Statut")}</th>
                    <th>{tr("Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shownLevels.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">{tr("Aucun niveau pour le filtre courant.")}</td></tr>
                  ) : (
                    shownLevels.map((item) => (
                      <tr key={item.id}>
                        <td data-label={tr("Cycle")}>{cycleById.get(item.cycleId)?.label || "-"}</td>
                        <td data-label={tr("Niveau")}>{item.label} ({item.code})</td>
                        <td data-label={tr("Cursus")}>{tr(formatAcademicTrackLabel(item.track))}</td>
                        <td data-label={tr("Ordre")}>{item.sortOrder}</td>
                        <td data-label={tr("Statut")}>{tr(formatReferenceStatusLabel(item.status))}</td>
                        <td data-label={tr("Action")}>
                          <ReferenceActionMenu
                            label={`Options niveau ${item.label}`}
                            onDelete={() => void deleteRef(`/levels/${item.id}`)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ResponsiveDataTable>
          </article>
  );
}
