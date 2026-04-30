import type { JSX } from "react";

import type { AcademicTrack, FieldErrors } from "../../../shared/types/app";

import {
  ACADEMIC_TRACK_OPTIONS,
  REFERENCE_STATUS_OPTIONS,
  TEACHING_MODE_OPTIONS
} from "../../../shared/constants/domain";
import {
  fieldError,
  focusFirstInlineErrorField,
  formatAcademicTrackLabel,
  formatReferenceStatusLabel,
  formatSchoolYearOptionLabel,
  hasFieldErrors,
  parseOptionalNumber,
  renderFieldLabel
} from "../utils/reference-ui";
import { useReferenceScreenContext } from "./reference-screen-context";

export function ClassesSection(): JSX.Element {
  const ctx = useReferenceScreenContext();
  const {
    classCycleOptions,
    classErrors,
    classForm,
    classLevelFilter,
    classYearFilter,
    classes,
    createRef,
    cycleById,
    defaultSchoolYearId,
    deleteRef,
    levelById,
    levels,
    schoolFieldValue,
    schoolName,
    schoolYearById,
    schoolYears,
    selectedClassCycle,
    selectedClassCycleId,
    selectedClassLevel,
    setClassErrors,
    setClassForm,
    setClassLevelFilter,
    setClassYearFilter,
    shownClasses
  } = ctx;
  const SCHOOL_NAME = schoolName;

  return (
<article id="reference-classes" data-step-id="classes" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Classe</h3>
                <p className="section-lead">
                  Instance reelle d'affectation pour une annee donnee, par exemple 6e A. Ici on separe
                  volontairement le niveau abstrait de la classe concrete.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{classes.length} classe(s)</span>
                <span className="module-inline-pill">Niveau et annee obligatoires</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const capacity = parseOptionalNumber(classForm.capacity);
                  const actualCapacity = parseOptionalNumber(classForm.actualCapacity);

                  if (!classForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
                  if (!classForm.levelId) errors.levelId = "Niveau requis.";
                  if (!classForm.track) errors.track = "Cursus requis.";
                  if (!classForm.code.trim()) errors.code = "Code classe requis.";
                  if (!classForm.label.trim()) errors.label = "Nom de la classe requis.";
                  if (capacity === undefined || capacity <= 0) {
                    errors.capacity = "L'effectif maximal doit etre strictement superieur a zero.";
                  }
                  if (!classForm.status) errors.status = "Statut requis.";
                  if (classForm.actualCapacity.trim() && (actualCapacity === undefined || actualCapacity < 0)) {
                    errors.actualCapacity = "Capacite reelle invalide.";
                  }
                  if (
                    actualCapacity !== undefined &&
                    capacity !== undefined &&
                    actualCapacity > capacity
                  ) {
                    errors.actualCapacity = "La capacite reelle ne peut pas depasser l'effectif maximal.";
                  }
                  if (selectedClassLevel && selectedClassLevel.track !== classForm.track) {
                    errors.track = "Le cursus de la classe doit rester coherent avec celui du niveau.";
                  }
                  if (
                    selectedClassCycle &&
                    classForm.schoolYearId &&
                    selectedClassCycle.schoolYearId !== classForm.schoolYearId
                  ) {
                    errors.schoolYearId = "L'annee de la classe doit correspondre a l'annee du niveau / cycle.";
                  }

                  setClassErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("classes");
                    return;
                  }

                  void createRef(
                    "/classes",
                    {
                      schoolYearId: classForm.schoolYearId,
                      levelId: classForm.levelId,
                      code: classForm.code.trim(),
                      label: classForm.label.trim(),
                      capacity,
                      track: classForm.track,
                      status: classForm.status,
                      homeroomTeacherName: classForm.homeroomTeacherName.trim() || undefined,
                      mainRoom: classForm.mainRoom.trim() || undefined,
                      actualCapacity,
                      filiere: classForm.filiere.trim() || undefined,
                      series: classForm.series.trim() || undefined,
                      speciality: classForm.speciality.trim() || undefined,
                      description: classForm.description.trim() || undefined,
                      teachingMode: classForm.teachingMode
                    },
                    "Classe creee."
                  ).then((ok) => {
                    if (ok) {
                      setClassErrors({});
                      setClassForm((prev) => ({
                        ...prev,
                        schoolYearId: prev.schoolYearId || defaultSchoolYearId,
                        code: "",
                        label: "",
                        capacity: "",
                        homeroomTeacherName: "",
                        mainRoom: "",
                        actualCapacity: "",
                        filiere: "",
                        series: "",
                        speciality: "",
                        description: "",
                        teachingMode: "PRESENTIAL"
                      }));
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Annee scolaire", { required: true })}
                  <select value={classForm.schoolYearId} onChange={(event) => setClassForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}>
                    <option value="">Choisir</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "schoolYearId")}
                </label>
                <label>
                  {renderFieldLabel("Niveau", { required: true })}
                  <select
                    value={classForm.levelId}
                    onChange={(event) => {
                      const nextLevelId = event.target.value;
                      const nextLevel = levelById.get(nextLevelId);
                      const nextCycle = nextLevel ? cycleById.get(nextLevel.cycleId) : undefined;
                      setClassForm((prev) => ({
                        ...prev,
                        levelId: nextLevelId,
                        track: nextLevel?.track || prev.track,
                        schoolYearId: nextCycle?.schoolYearId || prev.schoolYearId
                      }));
                    }}
                  >
                    <option value="">Choisir</option>
                    {levels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} - {cycleById.get(item.cycleId)?.label || "-"}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "levelId")}
                </label>
                <label>
                  {renderFieldLabel("Nom de la classe", { required: true })}
                  <input value={classForm.label} onChange={(event) => setClassForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="6e A" />
                  {fieldError(classErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={classForm.code} onChange={(event) => setClassForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="6A-2526" />
                  {fieldError(classErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Cursus", { required: true })}
                  <select value={classForm.track} onChange={(event) => setClassForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))}>
                    {ACADEMIC_TRACK_OPTIONS.map((track) => (
                      <option key={track} value={track}>
                        {formatAcademicTrackLabel(track)}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "track")}
                </label>
                <label>
                  {renderFieldLabel("Effectif maximal", { required: true })}
                  <input type="number" min={1} value={classForm.capacity} onChange={(event) => setClassForm((prev) => ({ ...prev, capacity: event.target.value }))} placeholder="30" />
                  {fieldError(classErrors, "capacity")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={classForm.status} onChange={(event) => setClassForm((prev) => ({ ...prev, status: event.target.value as "ACTIVE" | "INACTIVE" }))}>
                    {REFERENCE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatReferenceStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Titulaire / professeur principal")}
                  <input value={classForm.homeroomTeacherName} onChange={(event) => setClassForm((prev) => ({ ...prev, homeroomTeacherName: event.target.value }))} placeholder="M. Diallo" />
                  {fieldError(classErrors, "homeroomTeacherName")}
                </label>
                <label>
                  {renderFieldLabel("Salle principale")}
                  <input value={classForm.mainRoom} onChange={(event) => setClassForm((prev) => ({ ...prev, mainRoom: event.target.value }))} placeholder="B-12" />
                  {fieldError(classErrors, "mainRoom")}
                </label>
                <label>
                  {renderFieldLabel("Capacite reelle")}
                  <input type="number" min={0} value={classForm.actualCapacity} onChange={(event) => setClassForm((prev) => ({ ...prev, actualCapacity: event.target.value }))} placeholder="28" />
                  {fieldError(classErrors, "actualCapacity")}
                </label>
                <label>
                  {renderFieldLabel("Filiere")}
                  <input value={classForm.filiere} onChange={(event) => setClassForm((prev) => ({ ...prev, filiere: event.target.value }))} placeholder="General" />
                  {fieldError(classErrors, "filiere")}
                </label>
                <label>
                  {renderFieldLabel("Serie")}
                  <input value={classForm.series} onChange={(event) => setClassForm((prev) => ({ ...prev, series: event.target.value }))} placeholder="D" />
                  {fieldError(classErrors, "series")}
                </label>
                <label>
                  {renderFieldLabel("Specialite")}
                  <input value={classForm.speciality} onChange={(event) => setClassForm((prev) => ({ ...prev, speciality: event.target.value }))} placeholder="Sciences" />
                  {fieldError(classErrors, "speciality")}
                </label>
                <label>
                  {renderFieldLabel("Mode d'enseignement")}
                  <select value={classForm.teachingMode} onChange={(event) => setClassForm((prev) => ({ ...prev, teachingMode: event.target.value }))}>
                    {TEACHING_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "teachingMode")}
                </label>
                <label>
                  {renderFieldLabel("Cycle")}
                  <select className="reference-derived-select" value={selectedClassCycleId} disabled>
                    {selectedClassCycleId ? null : <option value="">Selectionner un niveau</option>}
                    {classCycleOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {renderFieldLabel("Etablissement")}
                  <select value={schoolFieldValue} onChange={() => undefined}>
                    <option value={schoolFieldValue}>{SCHOOL_NAME}</option>
                  </select>
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Description")}
                  <textarea value={classForm.description} onChange={(event) => setClassForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Contraintes d'affectation, orientation, salle specialisee..." />
                  {fieldError(classErrors, "description")}
                </label>
                <div className="actions">
                  <button type="submit">Creer la classe</button>
                </div>
              </form>
            </div>
            <div className="filter-grid module-filter">
              <label>
                {renderFieldLabel("Filtre annee")}
                <select value={classYearFilter} onChange={(event) => setClassYearFilter(event.target.value)}>
                  <option value="">Toutes les annees</option>
                  {schoolYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatSchoolYearOptionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {renderFieldLabel("Filtre niveau")}
                <select value={classLevelFilter} onChange={(event) => setClassLevelFilter(event.target.value)}>
                  <option value="">Tous les niveaux</option>
                  {levels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
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
                    <th>Classe</th>
                    <th>Niveau</th>
                    <th>Capacite</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shownClasses.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune classe pour le filtre courant.</td></tr>
                  ) : (
                    shownClasses.map((item) => (
                      <tr key={item.id}>
                        <td>{formatSchoolYearOptionLabel(schoolYearById.get(item.schoolYearId))}</td>
                        <td>{item.label} ({item.code})</td>
                        <td>{levelById.get(item.levelId)?.label || "-"}</td>
                        <td>{item.actualCapacity ?? item.capacity ?? "-"} / {item.capacity ?? "-"}</td>
                        <td>{formatReferenceStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/classes/${item.id}`, "Classe supprimee.")}>
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
