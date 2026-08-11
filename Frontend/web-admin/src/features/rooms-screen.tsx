import { type FormEvent, useEffect, useMemo, useState } from "react";

import type {
  ClassItem,
  Cycle,
  Level,
  Period,
  RoomAssignmentRecord,
  RoomAvailabilityRecord,
  RoomDetailRecord,
  RoomOccupancyRecord,
  RoomRecord,
  RoomTypeRecord,
  SchoolYear,
  Subject,
  WorkflowStepDef
} from "../shared/types/app";
import { WorkflowGuide } from "../shared/components/workflow-guide";
import { UI_MESSAGES } from "../shared/i18n";
import { RoomsListSection } from "./rooms/components/rooms-list-section";
import { toUiErrorMessage } from "../shared/services/api-errors";
import {
  createRoomAssignment,
  createRoomAvailability,
  createRoomType,
  deleteRoomResource,
  fetchRoomDetail,
  fetchRooms,
  fetchRoomsModule,
  saveRoom
} from "./rooms/rooms-service";
import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  AVAILABILITY_TYPES,
  ROOM_STATUSES,
  ROOM_TYPE_STATUSES,
  SCHOOL_NAME,
  TRACKS,
  type RoomAssignmentForm,
  type RoomAvailabilityForm,
  type RoomFilters,
  type RoomForm,
  type RoomTypeForm,
  assignmentTypeLabel,
  dayLabel,
  defaultAssignmentForm,
  defaultAvailabilityForm,
  defaultRoomFilters,
  defaultRoomForm,
  defaultRoomTypeForm,
  emptyToUndefined,
  numberOrUndefined,
  availabilityTypeLabel,
  statusLabel,
  trackLabel
} from "./rooms/rooms-screen-model";
import { useI18n } from "../shared/i18n-context";
import { ResponsiveForm } from "../shared/components/responsive-form";
import { useConfirmDialog } from "../shared/components/confirm-dialog";
import { ResponsiveDataTable } from "../shared/components/responsive-data-table";


type RoomsScreenProps = {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  classes: ClassItem[];
  cycles: Cycle[];
  levels: Level[];
  periods: Period[];
  schoolYears: SchoolYear[];
  subjects: Subject[];
  remoteEnabled?: boolean;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

export function RoomsScreen(props: RoomsScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const confirmAction = useConfirmDialog();
  const { api, classes, cycles, levels, onError, onNotice, periods, remoteEnabled = true, schoolYears, subjects } = props;
  const [activeStep, setActiveStep] = useState("list");
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRecord[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignmentRecord[]>([]);
  const [availabilities, setAvailabilities] = useState<RoomAvailabilityRecord[]>([]);
  const [occupancy, setOccupancy] = useState<RoomOccupancyRecord[]>([]);
  const [detail, setDetail] = useState<RoomDetailRecord | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<RoomFilters>(defaultRoomFilters);
  const [roomForm, setRoomForm] = useState<RoomForm>(defaultRoomForm);
  const [assignmentForm, setAssignmentForm] = useState<RoomAssignmentForm>(defaultAssignmentForm);
  const [availabilityForm, setAvailabilityForm] = useState<RoomAvailabilityForm>(defaultAvailabilityForm);
  const [roomTypeForm, setRoomTypeForm] = useState<RoomTypeForm>(defaultRoomTypeForm);

  const activeSchoolYear = useMemo(() => schoolYears.find((item) => item.isActive) || schoolYears[0], [schoolYears]);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const filteredClasses = classes.filter((item) => !assignmentForm.schoolYearId || item.schoolYearId === assignmentForm.schoolYearId);
  const filteredPeriods = periods.filter((item) => !assignmentForm.schoolYearId || item.schoolYearId === assignmentForm.schoolYearId);
  const selectedAssignments = selectedRoomId ? assignments.filter((item) => item.roomId === selectedRoomId) : assignments;
  const selectedAvailabilities = selectedRoomId ? availabilities.filter((item) => item.roomId === selectedRoomId) : availabilities;

  const steps: WorkflowStepDef[] = [
    { id: "list", title: "Liste des salles", hint: "Recherche, filtres, détail et archivage.", done: rooms.length > 0 },
    { id: "form", title: editingRoomId ? "Édition salle" : "Ajouter une salle", hint: "Identité, capacité, usage et cursus." },
    { id: "detail", title: "Détail salle", hint: "Fiche, affectations et indisponibilités." },
    { id: "assignments", title: "Affectations", hint: "Classe, niveau, cursus, matière et période.", done: assignments.length > 0 },
    { id: "availability", title: "Disponibilités", hint: "Maintenance, indisponibilités et réservations.", done: availabilities.length > 0 },
    { id: "occupancy", title: "Occupation", hint: "Synthèse par salle et par cursus.", done: occupancy.length > 0 },
    { id: "types", title: "Typologie des salles", hint: "Laboratoire, classe, informatique, examen.", done: roomTypes.length > 0 }
  ];

  const loadModule = async (): Promise<void> => {
    if (!remoteEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchRoomsModule(api, activeSchoolYear?.id);
      setRooms(data.rooms);
      setRoomTypes(data.roomTypes);
      setAssignments(data.assignments);
      setAvailabilities(data.availabilities);
      setOccupancy(data.occupancy);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async (): Promise<void> => {
    if (!remoteEnabled) return;
    try {
      setRooms(await fetchRooms(api, filters));
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    }
  };

  const loadDetail = async (roomId: string): Promise<void> => {
    if (!roomId) return;
    if (!remoteEnabled) return;
    try {
      setDetail(await fetchRoomDetail(api, roomId));
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    }
  };

  useEffect(() => {
    void loadModule();
  }, []);

  useEffect(() => {
    if (activeSchoolYear?.id && !assignmentForm.schoolYearId) {
      setAssignmentForm((prev) => ({ ...prev, schoolYearId: activeSchoolYear.id, startDate: activeSchoolYear.startDate || "" }));
      setAvailabilityForm((prev) => ({ ...prev, schoolYearId: activeSchoolYear.id }));
    }
  }, [activeSchoolYear?.id]);

  useEffect(() => {
    const roomId = selectedRoomId || rooms[0]?.id || "";
    if (!roomId) return;
    setAssignmentForm((prev) => (prev.roomId ? prev : { ...prev, roomId }));
    setAvailabilityForm((prev) => (prev.roomId ? prev : { ...prev, roomId }));
    if (activeStep === "detail" && selectedRoomId) void loadDetail(selectedRoomId);
    if (activeStep === "detail" && !selectedRoomId) setDetail(null);
  }, [activeStep, selectedRoomId, rooms]);

  const submitRoom = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      setEditingRoomId(null);
      setRoomForm(defaultRoomForm());
      setActiveStep("list");
      return;
    }
    let saved: RoomRecord;
    try {
      saved = await saveRoom(api, editingRoomId, {
        code: roomForm.code,
        name: roomForm.name,
        building: emptyToUndefined(roomForm.building),
        floor: emptyToUndefined(roomForm.floor),
        location: emptyToUndefined(roomForm.location),
        description: emptyToUndefined(roomForm.description),
        roomTypeId: roomForm.roomTypeId,
        capacity: numberOrUndefined(roomForm.capacity),
        examCapacity: numberOrUndefined(roomForm.examCapacity),
        status: roomForm.status,
        isSharedBetweenCurricula: roomForm.isSharedBetweenCurricula,
        defaultTrack: roomForm.isSharedBetweenCurricula ? undefined : emptyToUndefined(roomForm.defaultTrack),
        establishmentId: emptyToUndefined(roomForm.establishmentId),
        notes: emptyToUndefined(roomForm.notes)
      });
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    setSelectedRoomId(saved.id);
    setEditingRoomId(null);
    setRoomForm(defaultRoomForm());
    onNotice(UI_MESSAGES.saved);
    await loadModule();
    setActiveStep("detail");
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await createRoomAssignment(api, {
        roomId: assignmentForm.roomId,
        schoolYearId: assignmentForm.schoolYearId,
        classId: emptyToUndefined(assignmentForm.classId),
        levelId: emptyToUndefined(assignmentForm.levelId),
        cycleId: emptyToUndefined(assignmentForm.cycleId),
        track: emptyToUndefined(assignmentForm.track),
        subjectId: emptyToUndefined(assignmentForm.subjectId),
        periodId: emptyToUndefined(assignmentForm.periodId),
        assignmentType: assignmentForm.assignmentType,
        startDate: emptyToUndefined(assignmentForm.startDate),
        endDate: emptyToUndefined(assignmentForm.endDate),
        status: assignmentForm.status,
        comment: emptyToUndefined(assignmentForm.comment)
      });
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    onNotice(UI_MESSAGES.created);
    setAssignmentForm((prev) => ({ ...defaultAssignmentForm(), roomId: prev.roomId, schoolYearId: prev.schoolYearId }));
    await loadModule();
  };

  const submitAvailability = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await createRoomAvailability(api, {
        roomId: availabilityForm.roomId,
        dayOfWeek: numberOrUndefined(availabilityForm.dayOfWeek),
        startTime: emptyToUndefined(availabilityForm.startTime),
        endTime: emptyToUndefined(availabilityForm.endTime),
        availabilityType: availabilityForm.availabilityType,
        schoolYearId: emptyToUndefined(availabilityForm.schoolYearId),
        periodId: emptyToUndefined(availabilityForm.periodId),
        comment: emptyToUndefined(availabilityForm.comment)
      });
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    onNotice(UI_MESSAGES.saved);
    setAvailabilityForm((prev) => ({ ...defaultAvailabilityForm(), roomId: prev.roomId, schoolYearId: prev.schoolYearId }));
    await loadModule();
  };

  const submitRoomType = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await createRoomType(api, {
        code: roomTypeForm.code,
        name: roomTypeForm.name,
        description: emptyToUndefined(roomTypeForm.description),
        status: roomTypeForm.status
      });
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    onNotice(UI_MESSAGES.created);
    setRoomTypeForm(defaultRoomTypeForm());
    await loadModule();
  };

  const editRoom = (room: RoomRecord): void => {
    setEditingRoomId(room.id);
    setRoomForm({
      code: room.code,
      name: room.name,
      building: room.building || "",
      floor: room.floor || "",
      location: room.location || "",
      description: room.description || "",
      roomTypeId: room.roomTypeId,
      capacity: String(room.capacity),
      examCapacity: room.examCapacity ? String(room.examCapacity) : "",
      status: room.status,
      isSharedBetweenCurricula: room.isSharedBetweenCurricula,
      defaultTrack: room.defaultTrack || "",
      establishmentId: room.establishmentId || "",
      notes: room.notes || ""
    });
    setActiveStep("form");
  };

  const archiveResource = async (path: string, successMessage: string): Promise<void> => {
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await deleteRoomResource(api, path);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.deleteError));
      return;
    }
    onNotice(successMessage);
    await loadModule();
  };

  const openDetail = (roomId: string): void => {
    setSelectedRoomId(roomId);
    setActiveStep("detail");
    if (!remoteEnabled) return;
    void loadDetail(roomId);
  };

  return (
    <WorkflowGuide className="module-v3-workflow" title={tr("Salles")} steps={steps} activeStepId={activeStep} onStepChange={setActiveStep}>
      <div className="rooms-screen-shell module-v3-shell">
      {activeStep === "list" ? (
        <RoomsListSection
          filters={filters}
          loading={loading}
          onAddRoom={() => setActiveStep("form")}
          onArchiveRoom={async (roomId) => {
            const accepted = await confirmAction({
              description: tr(UI_MESSAGES.roomDeleteConfirm),
              confirmLabel: tr("Archiver"),
              tone: "danger"
            });
            if (accepted) await archiveResource(`/rooms/${roomId}`, UI_MESSAGES.deleted);
          }}
          onEditRoom={editRoom}
          onFilter={() => void loadRooms()}
          onOpenDetail={openDetail}
          onReload={() => void loadModule()}
          roomTypes={roomTypes}
          rooms={rooms}
          setFilters={setFilters}
        />
      ) : null}

      {activeStep === "form" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">{tr("Fiche salle")}</p><h2>{editingRoomId ? tr("Modifier la salle") : tr("Ajouter une salle")}</h2></div><span className="module-header-badge">{SCHOOL_NAME}</span></div>
          <ResponsiveForm
            className="form-grid module-form teachers-form-grid"
            formTitle={editingRoomId ? tr("Modifier la salle") : tr("Créer la salle")}
            openOnMount
            onSubmit={submitRoom}
          >
            <label>{tr("Code *")}<input value={roomForm.code} onChange={(event) => setRoomForm((prev) => ({ ...prev, code: event.target.value }))} required /></label>
            <label>{tr("Nom *")}<input value={roomForm.name} onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))} required /></label>
            <label>{tr("Type *")}<select value={roomForm.roomTypeId} onChange={(event) => setRoomForm((prev) => ({ ...prev, roomTypeId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
            <label>{tr("Capacité *")}<input type="number" min="1" value={roomForm.capacity} onChange={(event) => setRoomForm((prev) => ({ ...prev, capacity: event.target.value }))} required /></label>
            <label>{tr("Capacité examen")}<input type="number" min="1" max={roomForm.capacity || undefined} value={roomForm.examCapacity} onChange={(event) => setRoomForm((prev) => ({ ...prev, examCapacity: event.target.value }))} /></label>
            <label>{tr("Statut *")}<select value={roomForm.status} onChange={(event) => setRoomForm((prev) => ({ ...prev, status: event.target.value }))} required>{ROOM_STATUSES.map((status) => <option key={status} value={status}>{tr(statusLabel(status))}</option>)}</select></label>
            <label>{tr("Bâtiment")}<input value={roomForm.building} onChange={(event) => setRoomForm((prev) => ({ ...prev, building: event.target.value }))} /></label>
            <label>{tr("Étage")}<input value={roomForm.floor} onChange={(event) => setRoomForm((prev) => ({ ...prev, floor: event.target.value }))} /></label>
            <label>{tr("Localisation")}<input value={roomForm.location} onChange={(event) => setRoomForm((prev) => ({ ...prev, location: event.target.value }))} /></label>
            <label>{tr("Usage de la salle *")}<select value={roomForm.isSharedBetweenCurricula ? "shared" : "dedicated"} onChange={(event) => setRoomForm((prev) => ({ ...prev, isSharedBetweenCurricula: event.target.value === "shared", defaultTrack: event.target.value === "shared" ? "" : prev.defaultTrack }))} required><option value="shared">{tr("Partagée entre cursus")}</option><option value="dedicated">{tr("Réservée à un cursus")}</option></select></label>
            <label>{roomForm.isSharedBetweenCurricula ? tr("Cursus dédié") : tr("Cursus dédié *")}<select value={roomForm.defaultTrack} onChange={(event) => setRoomForm((prev) => ({ ...prev, defaultTrack: event.target.value as RoomForm["defaultTrack"] }))} disabled={roomForm.isSharedBetweenCurricula} required={!roomForm.isSharedBetweenCurricula}><option value="">{tr("Choisir")}</option>{TRACKS.map((track) => <option key={track} value={track}>{tr(trackLabel(track))}</option>)}</select></label>
            <label>{tr("Établissement *")}<select value={roomForm.establishmentId} onChange={(event) => setRoomForm((prev) => ({ ...prev, establishmentId: event.target.value }))}><option value="">{tr("Al Manarat Islamiyat")}</option></select></label>
            <label className="form-grid-span-full">{tr("Description")}<input value={roomForm.description} onChange={(event) => setRoomForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
            <label className="form-grid-span-full">{tr("Notes internes")}<textarea value={roomForm.notes} onChange={(event) => setRoomForm((prev) => ({ ...prev, notes: event.target.value }))} /></label>
            <div className="actions"><button type="submit">{editingRoomId ? tr("Mettre à jour") : tr("Créer la salle")}</button><button type="button" className="button-ghost" onClick={() => { setEditingRoomId(null); setRoomForm(defaultRoomForm()); }}>{tr("Réinitialiser")}</button></div>
          </ResponsiveForm>
        </section>
      ) : null}

      {activeStep === "detail" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header">
            <div><p className="section-kicker">{tr("Dossier salle")}</p><h2>{detail?.name || selectedRoom?.name || tr("Aucune salle sélectionnée")}</h2></div>
            {selectedRoom ? (
              <div className="module-inline-strip"><button type="button" className="button-ghost" onClick={() => editRoom(selectedRoom)}>{tr("Modifier")}</button><button type="button" onClick={() => setActiveStep("assignments")}>{tr("Affecter")}</button></div>
            ) : null}
          </div>
          {!detail ? (
            <div className="empty-state">
              <p className="section-lead">{tr("Sélectionnez une salle depuis la liste pour consulter sa fiche.")}</p>
              <button type="button" className="button-ghost" onClick={() => setActiveStep("list")}>{tr("Retour à la liste des salles")}</button>
            </div>
          ) : (
            <div className="teachers-detail-grid">
              <article className="module-overview-card teachers-identity-card"><span>{detail.code}</span><strong>{detail.name}</strong><small>{detail.roomTypeName || tr("Type non renseigné")} - {tr(statusLabel(detail.status))}</small><small>{detail.building || tr("Bâtiment non renseigné")} - {detail.location || tr("Localisation libre")}</small></article>
              <article className="module-overview-card"><span>{tr("Capacité")}</span><strong>{detail.capacity}</strong><small>{tr("Examen: ")}{detail.examCapacity || "-"}</small></article>
              <article className="module-overview-card"><span>{tr("Cursus")}</span><strong>{detail.isSharedBetweenCurricula ? tr("Partagée") : tr(trackLabel(detail.defaultTrack))}</strong><small>{tr("Compatibilité salle")}</small></article>
              <article className="module-overview-card"><span>{tr("Affectations")}</span><strong>{detail.assignments.length}</strong><small>{tr("Historique et usage")}</small></article>
              <article className="module-overview-card"><span>{tr("Disponibilités")}</span><strong>{detail.availabilities.length}</strong><small>{tr("Maintenance / réservations")}</small></article>
            </div>
          )}
        </section>
      ) : null}

      {activeStep === "assignments" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">{tr("Affectations salles")}</p><h2>{tr("Usage pédagogique et cursus")}</h2></div></div>
          <ResponsiveForm className="form-grid module-form teachers-form-grid" formTitle={tr("Créer l'affectation")} onSubmit={submitAssignment}>
            <label>{tr("Salle *")}<select value={assignmentForm.roomId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, roomId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{rooms.filter((room) => room.status === "ACTIVE").map((room) => <option key={room.id} value={room.id}>{room.code} - {room.name}</option>)}</select></label>
            <label>{tr("Année scolaire *")}<select value={assignmentForm.schoolYearId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.label || year.code}</option>)}</select></label>
            <label>{tr("Type d'affectation *")}<select value={assignmentForm.assignmentType} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, assignmentType: event.target.value }))} required>{ASSIGNMENT_TYPES.map((type) => <option key={type} value={type}>{tr(assignmentTypeLabel(type))}</option>)}</select></label>
            <label>{tr("Cursus")}<select value={assignmentForm.track} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, track: event.target.value as RoomAssignmentForm["track"] }))}><option value="">{tr("Partagé / non spécifié")}</option>{TRACKS.map((track) => <option key={track} value={track}>{tr(trackLabel(track))}</option>)}</select></label>
            <label>{tr("Classe")}<select value={assignmentForm.classId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, classId: event.target.value }))}><option value="">{tr("Optionnelle")}</option>{filteredClasses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>{tr("Niveau")}<select value={assignmentForm.levelId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, levelId: event.target.value }))}><option value="">{tr("Optionnel")}</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></label>
            <label>{tr("Cycle")}<select value={assignmentForm.cycleId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, cycleId: event.target.value }))}><option value="">{tr("Optionnel")}</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label>
            <label>{tr("Matière")}<select value={assignmentForm.subjectId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, subjectId: event.target.value }))}><option value="">{tr("Optionnelle")}</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select></label>
            <label>{tr("Période")}<select value={assignmentForm.periodId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, periodId: event.target.value }))}><option value="">{tr("Optionnelle")}</option>{filteredPeriods.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}</select></label>
            <label>{tr("Date de début *")}<input type="date" value={assignmentForm.startDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, startDate: event.target.value }))} required /></label>
            <label>{tr("Date de fin")}<input type="date" value={assignmentForm.endDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, endDate: event.target.value }))} /></label>
            <label>{tr("Statut *")}<select value={assignmentForm.status} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, status: event.target.value }))} required>{ASSIGNMENT_STATUSES.map((status) => <option key={status} value={status}>{tr(statusLabel(status))}</option>)}</select></label>
            <label className="form-grid-span-full">{tr("Commentaire")}<input value={assignmentForm.comment} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">{tr("Créer l'affectation")}</button></div>
          </ResponsiveForm>
          <ResponsiveDataTable className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>{tr("Salle")}</th><th>{tr("Type")}</th><th>{tr("Classe")}</th><th>{tr("Matière")}</th><th>{tr("Cursus")}</th><th>{tr("Année")}</th><th>{tr("Période")}</th><th>{tr("Statut")}</th><th>{tr("Action")}</th></tr></thead>
              <tbody>{selectedAssignments.length === 0 ? <tr><td colSpan={9} className="empty-row">{tr("Aucune affectation enregistrée.")}</td></tr> : selectedAssignments.map((item) => (
                <tr key={item.id}><td data-label={tr("Salle")}>{item.roomLabel}</td><td data-label={tr("Type")}>{tr(assignmentTypeLabel(item.assignmentType))}</td><td data-label={tr("Classe")}>{item.classLabel || item.levelLabel || item.cycleLabel || "-"}</td><td data-label={tr("Matière")}>{item.subjectLabel || "-"}</td><td data-label={tr("Cursus")}>{tr(trackLabel(item.track))}</td><td data-label={tr("Année")}>{item.schoolYearCode}</td><td data-label={tr("Période")}>{item.periodLabel || "-"}</td><td data-label={tr("Statut")}><span className="status-pill">{tr(statusLabel(item.status))}</span></td><td data-label={tr("Action")}><button type="button" className="button-ghost" onClick={() => void archiveResource(`/rooms/assignments/${item.id}`, UI_MESSAGES.archived)}>{tr("Archiver")}</button></td></tr>
              ))}</tbody>
            </table>
          </ResponsiveDataTable>
        </section>
      ) : null}

      {activeStep === "availability" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">{tr("Disponibilités")}</p><h2>{tr("Réservations, maintenance et indisponibilités")}</h2></div></div>
          <ResponsiveForm className="form-grid module-form teachers-form-grid" formTitle={tr("Déclarer une indisponibilité")} onSubmit={submitAvailability}>
            <label>{tr("Salle *")}<select value={availabilityForm.roomId} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, roomId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code} - {room.name}</option>)}</select></label>
            <label>{tr("Jour")}<select value={availabilityForm.dayOfWeek} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}><option value="">{tr("Tous")}</option>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={String(day)}>{tr(dayLabel(day))}</option>)}</select></label>
            <label>{tr("Début *")}<input type="time" value={availabilityForm.startTime} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, startTime: event.target.value }))} required /></label>
            <label>{tr("Fin *")}<input type="time" value={availabilityForm.endTime} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, endTime: event.target.value }))} required /></label>
            <label>{tr("Type *")}<select value={availabilityForm.availabilityType} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, availabilityType: event.target.value }))} required>{AVAILABILITY_TYPES.map((type) => <option key={type} value={type}>{tr(availabilityTypeLabel(type))}</option>)}</select></label>
            <label>{tr("Année scolaire")}<select value={availabilityForm.schoolYearId} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}><option value="">{tr("Toutes")}</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.label || year.code}</option>)}</select></label>
            <label>{tr("Période")}<select value={availabilityForm.periodId} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, periodId: event.target.value }))}><option value="">{tr("Optionnelle")}</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}</select></label>
            <label className="form-grid-span-full">{tr("Commentaire")}<input value={availabilityForm.comment} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">{tr("Déclarer une indisponibilité")}</button></div>
          </ResponsiveForm>
          <ResponsiveDataTable className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>{tr("Salle")}</th><th>{tr("Jour")}</th><th>{tr("Début")}</th><th>{tr("Fin")}</th><th>{tr("Type")}</th><th>{tr("Année")}</th><th>{tr("Période")}</th><th>{tr("Action")}</th></tr></thead>
              <tbody>{selectedAvailabilities.length === 0 ? <tr><td colSpan={8} className="empty-row">{tr("Aucune indisponibilité enregistrée.")}</td></tr> : selectedAvailabilities.map((item) => (
                <tr key={item.id}><td data-label={tr("Salle")}>{item.roomLabel}</td><td data-label={tr("Jour")}>{tr(dayLabel(item.dayOfWeek))}</td><td data-label={tr("Début")}>{item.startTime || "-"}</td><td data-label={tr("Fin")}>{item.endTime || "-"}</td><td data-label={tr("Type")}>{tr(availabilityTypeLabel(item.availabilityType))}</td><td data-label={tr("Année")}>{item.schoolYearCode || "-"}</td><td data-label={tr("Période")}>{item.periodLabel || "-"}</td><td data-label={tr("Action")}><button type="button" className="button-danger" onClick={() => void archiveResource(`/rooms/availabilities/${item.id}`, UI_MESSAGES.deleted)}>{tr("Supprimer")}</button></td></tr>
              ))}</tbody>
            </table>
          </ResponsiveDataTable>
        </section>
      ) : null}

      {activeStep === "occupancy" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">{tr("Occupation")}</p><h2>{tr("Synthèse d'occupation par salle")}</h2></div></div>
          <ResponsiveDataTable className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>{tr("Salle")}</th><th>{tr("Type")}</th><th>{tr("Capacité")}</th><th>{tr("Cursus")}</th><th>{tr("Affectations")}</th><th>{tr("FR")}</th><th>{tr("AR")}</th><th>{tr("Partage")}</th><th>{tr("Classes")}</th><th>{tr("Matières")}</th><th>{tr("Statut")}</th></tr></thead>
              <tbody>{occupancy.length === 0 ? <tr><td colSpan={11} className="empty-row">{tr("Aucune occupation calculée pour le moment.")}</td></tr> : occupancy.map((item) => (
                <tr key={item.roomId}><td data-label={tr("Salle")}>{item.roomLabel}</td><td data-label={tr("Type")}>{item.roomTypeName || "-"}</td><td data-label={tr("Capacité")}>{item.capacity}</td><td data-label={tr("Cursus")}>{item.isSharedBetweenCurricula ? tr("Partagée") : tr(trackLabel(item.defaultTrack))}</td><td data-label={tr("Affectations")}>{item.assignmentsCount}</td><td data-label={tr("FR")}>{item.francophoneAssignmentsCount}</td><td data-label={tr("AR")}>{item.arabophoneAssignmentsCount}</td><td data-label={tr("Partage")}>{item.sharedAssignmentsCount}</td><td data-label={tr("Classes")}>{item.classes.join(", ") || "-"}</td><td data-label={tr("Matières")}>{item.subjects.join(", ") || "-"}</td><td data-label={tr("Statut")}><span className="status-pill">{tr(statusLabel(item.status))}</span></td></tr>
              ))}</tbody>
            </table>
          </ResponsiveDataTable>
        </section>
      ) : null}

      {activeStep === "types" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">{tr("Typologie")}</p><h2>{tr("Typologie des salles")}</h2></div></div>
          <ResponsiveForm className="form-grid module-form teachers-form-grid" formTitle={tr("Ajouter le type")} onSubmit={submitRoomType}>
            <label>{tr("Code *")}<input value={roomTypeForm.code} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, code: event.target.value }))} required placeholder={tr("CLASSROOM")} /></label>
            <label>{tr("Nom *")}<input value={roomTypeForm.name} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, name: event.target.value }))} required placeholder={tr("Salle de classe")} /></label>
            <label>{tr("Statut *")}<select value={roomTypeForm.status} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, status: event.target.value }))} required>{ROOM_TYPE_STATUSES.map((status) => <option key={status} value={status}>{tr(statusLabel(status))}</option>)}</select></label>
            <label className="form-grid-span-full">{tr("Description")}<input value={roomTypeForm.description} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
            <div className="actions"><button type="submit">{tr("Ajouter le type")}</button></div>
          </ResponsiveForm>
          <ResponsiveDataTable className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>{tr("Code")}</th><th>{tr("Nom")}</th><th>{tr("Description")}</th><th>{tr("Statut")}</th></tr></thead>
              <tbody>{roomTypes.length === 0 ? <tr><td colSpan={4} className="empty-row">{tr("Aucun type de salle enregistré.")}</td></tr> : roomTypes.map((type) => (
                <tr key={type.id}><td data-label={tr("Code")}>{type.code}</td><td data-label={tr("Nom")}>{type.name}</td><td data-label={tr("Description")}>{type.description || "-"}</td><td data-label={tr("Statut")}><span className="status-pill">{tr(statusLabel(type.status))}</span></td></tr>
              ))}</tbody>
            </table>
          </ResponsiveDataTable>
        </section>
      ) : null}
      </div>
    </WorkflowGuide>
  );
}
