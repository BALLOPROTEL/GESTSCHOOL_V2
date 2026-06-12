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
import { RoomsListSection } from "./rooms/components/rooms-list-section";
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
      onError(error instanceof Error ? error.message : "Impossible de charger le module salles.");
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async (): Promise<void> => {
    if (!remoteEnabled) return;
    try {
      setRooms(await fetchRooms(api, filters));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de filtrer les salles.");
    }
  };

  const loadDetail = async (roomId: string): Promise<void> => {
    if (!roomId) return;
    if (!remoteEnabled) return;
    try {
      setDetail(await fetchRoomDetail(api, roomId));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de charger le détail de la salle.");
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
      onNotice("Mode aperçu local : salle non persistée.");
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
      onError(error instanceof Error ? error.message : "Impossible d'enregistrer la salle.");
      return;
    }
    setSelectedRoomId(saved.id);
    setEditingRoomId(null);
    setRoomForm(defaultRoomForm());
    onNotice("Salle enregistrée.");
    await loadModule();
    setActiveStep("detail");
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!remoteEnabled) {
      onNotice("Mode aperçu local : affectation de salle non persistée.");
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
      onError(error instanceof Error ? error.message : "Impossible de créer l'affectation de salle.");
      return;
    }
    onNotice("Affectation de salle créée.");
    setAssignmentForm((prev) => ({ ...defaultAssignmentForm(), roomId: prev.roomId, schoolYearId: prev.schoolYearId }));
    await loadModule();
  };

  const submitAvailability = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!remoteEnabled) {
      onNotice("Mode aperçu local : indisponibilité de salle non persistée.");
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
      onError(error instanceof Error ? error.message : "Impossible d'ajouter l'indisponibilité de salle.");
      return;
    }
    onNotice("Indisponibilité de salle enregistrée.");
    setAvailabilityForm((prev) => ({ ...defaultAvailabilityForm(), roomId: prev.roomId, schoolYearId: prev.schoolYearId }));
    await loadModule();
  };

  const submitRoomType = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!remoteEnabled) {
      onNotice("Mode aperçu local : type de salle non persisté.");
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
      onError(error instanceof Error ? error.message : "Impossible d'ajouter le type de salle.");
      return;
    }
    onNotice("Type de salle ajouté.");
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
      onNotice("Mode aperçu local : suppression salle non persistée.");
      return;
    }
    try {
      await deleteRoomResource(api, path);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de supprimer la ressource salle.");
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
    <WorkflowGuide className="module-v3-workflow" title="Salles" steps={steps} activeStepId={activeStep} onStepChange={setActiveStep}>
      <div className="rooms-screen-shell module-v3-shell">
      {activeStep === "list" ? (
        <RoomsListSection
          filters={filters}
          loading={loading}
          onAddRoom={() => setActiveStep("form")}
          onArchiveRoom={(roomId) => {
            if (window.confirm("Supprimer cette salle ?")) void archiveResource(`/rooms/${roomId}`, "Salle supprimée.");
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
          <div className="table-header"><div><p className="section-kicker">Fiche salle</p><h2>{editingRoomId ? "Modifier la salle" : "Ajouter une salle"}</h2></div><span className="module-header-badge">{SCHOOL_NAME}</span></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitRoom}>
            <label>Code *<input value={roomForm.code} onChange={(event) => setRoomForm((prev) => ({ ...prev, code: event.target.value }))} required /></label>
            <label>Nom *<input value={roomForm.name} onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))} required /></label>
            <label>Type *<select value={roomForm.roomTypeId} onChange={(event) => setRoomForm((prev) => ({ ...prev, roomTypeId: event.target.value }))} required><option value="">Choisir</option>{roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
            <label>Capacité *<input type="number" min="1" value={roomForm.capacity} onChange={(event) => setRoomForm((prev) => ({ ...prev, capacity: event.target.value }))} required /></label>
            <label>Capacité examen<input type="number" min="1" max={roomForm.capacity || undefined} value={roomForm.examCapacity} onChange={(event) => setRoomForm((prev) => ({ ...prev, examCapacity: event.target.value }))} /></label>
            <label>Statut *<select value={roomForm.status} onChange={(event) => setRoomForm((prev) => ({ ...prev, status: event.target.value }))} required>{ROOM_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
            <label>Bâtiment<input value={roomForm.building} onChange={(event) => setRoomForm((prev) => ({ ...prev, building: event.target.value }))} /></label>
            <label>Étage<input value={roomForm.floor} onChange={(event) => setRoomForm((prev) => ({ ...prev, floor: event.target.value }))} /></label>
            <label>Localisation<input value={roomForm.location} onChange={(event) => setRoomForm((prev) => ({ ...prev, location: event.target.value }))} /></label>
            <label>Usage de la salle *<select value={roomForm.isSharedBetweenCurricula ? "shared" : "dedicated"} onChange={(event) => setRoomForm((prev) => ({ ...prev, isSharedBetweenCurricula: event.target.value === "shared", defaultTrack: event.target.value === "shared" ? "" : prev.defaultTrack }))} required><option value="shared">Partagée entre cursus</option><option value="dedicated">Réservée à un cursus</option></select></label>
            <label>{roomForm.isSharedBetweenCurricula ? "Cursus dédié" : "Cursus dédié *"}<select value={roomForm.defaultTrack} onChange={(event) => setRoomForm((prev) => ({ ...prev, defaultTrack: event.target.value as RoomForm["defaultTrack"] }))} disabled={roomForm.isSharedBetweenCurricula} required={!roomForm.isSharedBetweenCurricula}><option value="">Choisir</option>{TRACKS.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}</select></label>
            <label>Établissement *<select value={roomForm.establishmentId} onChange={(event) => setRoomForm((prev) => ({ ...prev, establishmentId: event.target.value }))}><option value="">Al Manarat Islamiyat</option></select></label>
            <label className="form-grid-span-full">Description<input value={roomForm.description} onChange={(event) => setRoomForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
            <label className="form-grid-span-full">Notes internes<textarea value={roomForm.notes} onChange={(event) => setRoomForm((prev) => ({ ...prev, notes: event.target.value }))} /></label>
            <div className="actions"><button type="submit">{editingRoomId ? "Mettre à jour" : "Créer la salle"}</button><button type="button" className="button-ghost" onClick={() => { setEditingRoomId(null); setRoomForm(defaultRoomForm()); }}>Réinitialiser</button></div>
          </form>
        </section>
      ) : null}

      {activeStep === "detail" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header">
            <div><p className="section-kicker">Dossier salle</p><h2>{detail?.name || selectedRoom?.name || "Aucune salle sélectionnée"}</h2></div>
            {selectedRoom ? (
              <div className="module-inline-strip"><button type="button" className="button-ghost" onClick={() => editRoom(selectedRoom)}>Modifier</button><button type="button" onClick={() => setActiveStep("assignments")}>Affecter</button></div>
            ) : null}
          </div>
          {!detail ? (
            <div className="empty-state">
              <p className="section-lead">Sélectionnez une salle depuis la liste pour consulter sa fiche.</p>
              <button type="button" className="button-ghost" onClick={() => setActiveStep("list")}>Retour à la liste des salles</button>
            </div>
          ) : (
            <div className="teachers-detail-grid">
              <article className="module-overview-card teachers-identity-card"><span>{detail.code}</span><strong>{detail.name}</strong><small>{detail.roomTypeName || "Type non renseigné"} - {statusLabel(detail.status)}</small><small>{detail.building || "Bâtiment non renseigné"} - {detail.location || "Localisation libre"}</small></article>
              <article className="module-overview-card"><span>Capacité</span><strong>{detail.capacity}</strong><small>Examen: {detail.examCapacity || "-"}</small></article>
              <article className="module-overview-card"><span>Cursus</span><strong>{detail.isSharedBetweenCurricula ? "Partagée" : trackLabel(detail.defaultTrack)}</strong><small>Compatibilité salle</small></article>
              <article className="module-overview-card"><span>Affectations</span><strong>{detail.assignments.length}</strong><small>Historique et usage</small></article>
              <article className="module-overview-card"><span>Disponibilités</span><strong>{detail.availabilities.length}</strong><small>Maintenance / réservations</small></article>
            </div>
          )}
        </section>
      ) : null}

      {activeStep === "assignments" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Affectations salles</p><h2>Usage pédagogique et cursus</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitAssignment}>
            <label>Salle *<select value={assignmentForm.roomId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, roomId: event.target.value }))} required><option value="">Choisir</option>{rooms.filter((room) => room.status === "ACTIVE").map((room) => <option key={room.id} value={room.id}>{room.code} - {room.name}</option>)}</select></label>
            <label>Année scolaire *<select value={assignmentForm.schoolYearId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))} required><option value="">Choisir</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.label || year.code}</option>)}</select></label>
            <label>Type d'affectation *<select value={assignmentForm.assignmentType} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, assignmentType: event.target.value }))} required>{ASSIGNMENT_TYPES.map((type) => <option key={type} value={type}>{assignmentTypeLabel(type)}</option>)}</select></label>
            <label>Cursus<select value={assignmentForm.track} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, track: event.target.value as RoomAssignmentForm["track"] }))}><option value="">Partagé / non spécifié</option>{TRACKS.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}</select></label>
            <label>Classe<select value={assignmentForm.classId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, classId: event.target.value }))}><option value="">Optionnelle</option>{filteredClasses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Niveau<select value={assignmentForm.levelId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, levelId: event.target.value }))}><option value="">Optionnel</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></label>
            <label>Cycle<select value={assignmentForm.cycleId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, cycleId: event.target.value }))}><option value="">Optionnel</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label>
            <label>Matière<select value={assignmentForm.subjectId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, subjectId: event.target.value }))}><option value="">Optionnelle</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select></label>
            <label>Période<select value={assignmentForm.periodId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, periodId: event.target.value }))}><option value="">Optionnelle</option>{filteredPeriods.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}</select></label>
            <label>Date de début *<input type="date" value={assignmentForm.startDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, startDate: event.target.value }))} required /></label>
            <label>Date de fin<input type="date" value={assignmentForm.endDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, endDate: event.target.value }))} /></label>
            <label>Statut *<select value={assignmentForm.status} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, status: event.target.value }))} required>{ASSIGNMENT_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
            <label className="form-grid-span-full">Commentaire<input value={assignmentForm.comment} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">Créer l'affectation</button></div>
          </form>
          <div className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>Salle</th><th>Type</th><th>Classe</th><th>Matière</th><th>Cursus</th><th>Année</th><th>Période</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>{selectedAssignments.length === 0 ? <tr><td colSpan={9} className="empty-row">Aucune affectation enregistrée.</td></tr> : selectedAssignments.map((item) => (
                <tr key={item.id}><td>{item.roomLabel}</td><td>{assignmentTypeLabel(item.assignmentType)}</td><td>{item.classLabel || item.levelLabel || item.cycleLabel || "-"}</td><td>{item.subjectLabel || "-"}</td><td>{trackLabel(item.track)}</td><td>{item.schoolYearCode}</td><td>{item.periodLabel || "-"}</td><td><span className="status-pill">{statusLabel(item.status)}</span></td><td><button type="button" className="button-ghost" onClick={() => void archiveResource(`/rooms/assignments/${item.id}`, "Affectation salle archivée.")}>Archiver</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "availability" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Disponibilités</p><h2>Réservations, maintenance et indisponibilités</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitAvailability}>
            <label>Salle *<select value={availabilityForm.roomId} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, roomId: event.target.value }))} required><option value="">Choisir</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code} - {room.name}</option>)}</select></label>
            <label>Jour<select value={availabilityForm.dayOfWeek} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}><option value="">Tous</option>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={String(day)}>{dayLabel(day)}</option>)}</select></label>
            <label>Début *<input type="time" value={availabilityForm.startTime} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, startTime: event.target.value }))} required /></label>
            <label>Fin *<input type="time" value={availabilityForm.endTime} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, endTime: event.target.value }))} required /></label>
            <label>Type *<select value={availabilityForm.availabilityType} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, availabilityType: event.target.value }))} required>{AVAILABILITY_TYPES.map((type) => <option key={type} value={type}>{availabilityTypeLabel(type)}</option>)}</select></label>
            <label>Année scolaire<select value={availabilityForm.schoolYearId} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}><option value="">Toutes</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.label || year.code}</option>)}</select></label>
            <label>Période<select value={availabilityForm.periodId} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, periodId: event.target.value }))}><option value="">Optionnelle</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}</select></label>
            <label className="form-grid-span-full">Commentaire<input value={availabilityForm.comment} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">Déclarer une indisponibilité</button></div>
          </form>
          <div className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>Salle</th><th>Jour</th><th>Début</th><th>Fin</th><th>Type</th><th>Année</th><th>Période</th><th>Action</th></tr></thead>
              <tbody>{selectedAvailabilities.length === 0 ? <tr><td colSpan={8} className="empty-row">Aucune indisponibilité enregistrée.</td></tr> : selectedAvailabilities.map((item) => (
                <tr key={item.id}><td>{item.roomLabel}</td><td>{dayLabel(item.dayOfWeek)}</td><td>{item.startTime || "-"}</td><td>{item.endTime || "-"}</td><td>{availabilityTypeLabel(item.availabilityType)}</td><td>{item.schoolYearCode || "-"}</td><td>{item.periodLabel || "-"}</td><td><button type="button" className="button-danger" onClick={() => void archiveResource(`/rooms/availabilities/${item.id}`, "Indisponibilité supprimée.")}>Supprimer</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "occupancy" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Occupation</p><h2>Synthèse d'occupation par salle</h2></div></div>
          <div className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>Salle</th><th>Type</th><th>Capacité</th><th>Cursus</th><th>Affectations</th><th>FR</th><th>AR</th><th>Partage</th><th>Classes</th><th>Matières</th><th>Statut</th></tr></thead>
              <tbody>{occupancy.length === 0 ? <tr><td colSpan={11} className="empty-row">Aucune occupation calculée pour le moment.</td></tr> : occupancy.map((item) => (
                <tr key={item.roomId}><td>{item.roomLabel}</td><td>{item.roomTypeName || "-"}</td><td>{item.capacity}</td><td>{item.isSharedBetweenCurricula ? "Partagée" : trackLabel(item.defaultTrack)}</td><td>{item.assignmentsCount}</td><td>{item.francophoneAssignmentsCount}</td><td>{item.arabophoneAssignmentsCount}</td><td>{item.sharedAssignmentsCount}</td><td>{item.classes.join(", ") || "-"}</td><td>{item.subjects.join(", ") || "-"}</td><td><span className="status-pill">{statusLabel(item.status)}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "types" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Typologie</p><h2>Typologie des salles</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitRoomType}>
            <label>Code *<input value={roomTypeForm.code} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, code: event.target.value }))} required placeholder="CLASSROOM" /></label>
            <label>Nom *<input value={roomTypeForm.name} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, name: event.target.value }))} required placeholder="Salle de classe" /></label>
            <label>Statut *<select value={roomTypeForm.status} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, status: event.target.value }))} required>{ROOM_TYPE_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
            <label className="form-grid-span-full">Description<input value={roomTypeForm.description} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
            <div className="actions"><button type="submit">Ajouter le type</button></div>
          </form>
          <div className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>Code</th><th>Nom</th><th>Description</th><th>Statut</th></tr></thead>
              <tbody>{roomTypes.length === 0 ? <tr><td colSpan={4} className="empty-row">Aucun type de salle enregistré.</td></tr> : roomTypes.map((type) => (
                <tr key={type.id}><td>{type.code}</td><td>{type.name}</td><td>{type.description || "-"}</td><td><span className="status-pill">{statusLabel(type.status)}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}
      </div>
    </WorkflowGuide>
  );
}
