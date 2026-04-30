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
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

export function RoomsScreen(props: RoomsScreenProps): JSX.Element {
  const { api, classes, cycles, levels, onError, onNotice, periods, schoolYears, subjects } = props;
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
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || rooms[0];
  const filteredClasses = classes.filter((item) => !assignmentForm.schoolYearId || item.schoolYearId === assignmentForm.schoolYearId);
  const filteredPeriods = periods.filter((item) => !assignmentForm.schoolYearId || item.schoolYearId === assignmentForm.schoolYearId);
  const selectedAssignments = selectedRoomId ? assignments.filter((item) => item.roomId === selectedRoomId) : assignments;
  const selectedAvailabilities = selectedRoomId ? availabilities.filter((item) => item.roomId === selectedRoomId) : availabilities;

  const steps: WorkflowStepDef[] = [
    { id: "list", title: "Liste des salles", hint: "Recherche, filtres, detail et archivage.", done: rooms.length > 0 },
    { id: "form", title: editingRoomId ? "Edition salle" : "Ajouter une salle", hint: "Identite, capacite, usage et cursus." },
    { id: "detail", title: "Detail salle", hint: "Fiche, affectations et disponibilites." },
    { id: "assignments", title: "Affectations", hint: "Classe, niveau, cursus, matiere et periode.", done: assignments.length > 0 },
    { id: "availability", title: "Disponibilites", hint: "Maintenance, indisponibilites et reservations.", done: availabilities.length > 0 },
    { id: "occupancy", title: "Occupation", hint: "Synthese par salle et par cursus.", done: occupancy.length > 0 },
    { id: "types", title: "Types de salles", hint: "Laboratoire, classe, informatique, examen.", done: roomTypes.length > 0 }
  ];

  const loadModule = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await fetchRoomsModule(api, activeSchoolYear?.id);
      setRooms(data.rooms);
      setRoomTypes(data.roomTypes);
      setAssignments(data.assignments);
      setAvailabilities(data.availabilities);
      setOccupancy(data.occupancy);
      if (!selectedRoomId && data.rooms[0]) setSelectedRoomId(data.rooms[0].id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de charger le module salles.");
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async (): Promise<void> => {
    try {
      setRooms(await fetchRooms(api, filters));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de filtrer les salles.");
    }
  };

  const loadDetail = async (roomId: string): Promise<void> => {
    if (!roomId) return;
    try {
      setDetail(await fetchRoomDetail(api, roomId));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de charger le detail de la salle.");
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
    if (activeStep === "detail") void loadDetail(roomId);
  }, [activeStep, selectedRoomId, rooms]);

  const submitRoom = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
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
    onNotice("Salle enregistree.");
    await loadModule();
    setActiveStep("detail");
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
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
      onError(error instanceof Error ? error.message : "Impossible de creer l'affectation de salle.");
      return;
    }
    onNotice("Affectation de salle creee.");
    setAssignmentForm((prev) => ({ ...defaultAssignmentForm(), roomId: prev.roomId, schoolYearId: prev.schoolYearId }));
    await loadModule();
  };

  const submitAvailability = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
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
      onError(error instanceof Error ? error.message : "Impossible d'ajouter la disponibilite de salle.");
      return;
    }
    onNotice("Disponibilite de salle ajoutee.");
    setAvailabilityForm((prev) => ({ ...defaultAvailabilityForm(), roomId: prev.roomId, schoolYearId: prev.schoolYearId }));
    await loadModule();
  };

  const submitRoomType = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
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
    onNotice("Type de salle ajoute.");
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
    void loadDetail(roomId);
  };

  return (
    <WorkflowGuide title="Salles" steps={steps} activeStepId={activeStep} onStepChange={setActiveStep}>
      <div className="rooms-screen-shell">
      {activeStep === "list" ? (
        <RoomsListSection
          filters={filters}
          loading={loading}
          onAddRoom={() => setActiveStep("form")}
          onArchiveRoom={(roomId) => void archiveResource(`/rooms/${roomId}`, "Salle archivee.")}
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
          <div className="table-header"><div><p className="section-kicker">Fiche salle</p><h2>{editingRoomId ? "Modifier salle" : "Ajouter une salle"}</h2></div><span className="module-header-badge">{SCHOOL_NAME}</span></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitRoom}>
            <label>Code<input value={roomForm.code} onChange={(event) => setRoomForm((prev) => ({ ...prev, code: event.target.value }))} required /></label>
            <label>Nom<input value={roomForm.name} onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))} required /></label>
            <label>Type<select value={roomForm.roomTypeId} onChange={(event) => setRoomForm((prev) => ({ ...prev, roomTypeId: event.target.value }))} required><option value="">Choisir</option>{roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
            <label>Capacite<input type="number" min="1" value={roomForm.capacity} onChange={(event) => setRoomForm((prev) => ({ ...prev, capacity: event.target.value }))} required /></label>
            <label>Capacite examen<input type="number" min="1" value={roomForm.examCapacity} onChange={(event) => setRoomForm((prev) => ({ ...prev, examCapacity: event.target.value }))} /></label>
            <label>Statut<select value={roomForm.status} onChange={(event) => setRoomForm((prev) => ({ ...prev, status: event.target.value }))}>{ROOM_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Batiment<input value={roomForm.building} onChange={(event) => setRoomForm((prev) => ({ ...prev, building: event.target.value }))} /></label>
            <label>Etage<input value={roomForm.floor} onChange={(event) => setRoomForm((prev) => ({ ...prev, floor: event.target.value }))} /></label>
            <label>Localisation<input value={roomForm.location} onChange={(event) => setRoomForm((prev) => ({ ...prev, location: event.target.value }))} /></label>
            <label className="check-row"><input type="checkbox" checked={roomForm.isSharedBetweenCurricula} onChange={(event) => setRoomForm((prev) => ({ ...prev, isSharedBetweenCurricula: event.target.checked, defaultTrack: event.target.checked ? "" : prev.defaultTrack }))} /> Salle partagee entre cursus</label>
            <label>Cursus dedie<select value={roomForm.defaultTrack} onChange={(event) => setRoomForm((prev) => ({ ...prev, defaultTrack: event.target.value as RoomForm["defaultTrack"] }))} disabled={roomForm.isSharedBetweenCurricula}><option value="">Choisir</option>{TRACKS.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}</select></label>
            <label>Etablissement<select value={roomForm.establishmentId} onChange={(event) => setRoomForm((prev) => ({ ...prev, establishmentId: event.target.value }))}><option value="">Al Manarat Islamiyat</option></select></label>
            <label className="form-grid-span-full">Description<input value={roomForm.description} onChange={(event) => setRoomForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
            <label className="form-grid-span-full">Notes<textarea value={roomForm.notes} onChange={(event) => setRoomForm((prev) => ({ ...prev, notes: event.target.value }))} /></label>
            <div className="actions"><button type="submit">{editingRoomId ? "Mettre a jour" : "Creer salle"}</button><button type="button" className="button-ghost" onClick={() => { setEditingRoomId(null); setRoomForm(defaultRoomForm()); }}>Reinitialiser</button></div>
          </form>
        </section>
      ) : null}

      {activeStep === "detail" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header">
            <div><p className="section-kicker">Dossier salle</p><h2>{detail?.name || selectedRoom?.name || "Detail salle"}</h2></div>
            <div className="module-inline-strip"><button type="button" className="button-ghost" onClick={() => selectedRoom && editRoom(selectedRoom)}>Modifier</button><button type="button" onClick={() => setActiveStep("assignments")}>Affecter</button></div>
          </div>
          {!detail ? <p className="section-lead">Selectionnez une salle depuis la liste.</p> : (
            <div className="teachers-detail-grid">
              <article className="module-overview-card teachers-identity-card"><span>{detail.code}</span><strong>{detail.name}</strong><small>{detail.roomTypeName || "Type non renseigne"} - {detail.status}</small><small>{detail.building || "Batiment non renseigne"} - {detail.location || "Localisation libre"}</small></article>
              <article className="module-overview-card"><span>Capacite</span><strong>{detail.capacity}</strong><small>Examen: {detail.examCapacity || "-"}</small></article>
              <article className="module-overview-card"><span>Cursus</span><strong>{detail.isSharedBetweenCurricula ? "Partagee" : trackLabel(detail.defaultTrack)}</strong><small>Compatibilite salle</small></article>
              <article className="module-overview-card"><span>Affectations</span><strong>{detail.assignments.length}</strong><small>Historique et usage</small></article>
              <article className="module-overview-card"><span>Disponibilites</span><strong>{detail.availabilities.length}</strong><small>Maintenance / reserves</small></article>
            </div>
          )}
        </section>
      ) : null}

      {activeStep === "assignments" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Affectations salles</p><h2>Usage pedagogique et cursus</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitAssignment}>
            <label>Salle<select value={assignmentForm.roomId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, roomId: event.target.value }))} required><option value="">Choisir</option>{rooms.filter((room) => room.status === "ACTIVE").map((room) => <option key={room.id} value={room.id}>{room.code} - {room.name}</option>)}</select></label>
            <label>Annee scolaire<select value={assignmentForm.schoolYearId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))} required><option value="">Choisir</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.label || year.code}</option>)}</select></label>
            <label>Type<select value={assignmentForm.assignmentType} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, assignmentType: event.target.value }))}>{ASSIGNMENT_TYPES.map((type) => <option key={type} value={type}>{assignmentTypeLabel(type)}</option>)}</select></label>
            <label>Cursus<select value={assignmentForm.track} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, track: event.target.value as RoomAssignmentForm["track"] }))}><option value="">Partage / non specifie</option>{TRACKS.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}</select></label>
            <label>Classe<select value={assignmentForm.classId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, classId: event.target.value }))}><option value="">Optionnelle</option>{filteredClasses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Niveau<select value={assignmentForm.levelId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, levelId: event.target.value }))}><option value="">Optionnel</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></label>
            <label>Cycle<select value={assignmentForm.cycleId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, cycleId: event.target.value }))}><option value="">Optionnel</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label>
            <label>Matiere<select value={assignmentForm.subjectId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, subjectId: event.target.value }))}><option value="">Optionnelle</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select></label>
            <label>Periode<select value={assignmentForm.periodId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, periodId: event.target.value }))}><option value="">Optionnelle</option>{filteredPeriods.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}</select></label>
            <label>Debut<input type="date" value={assignmentForm.startDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, startDate: event.target.value }))} /></label>
            <label>Fin<input type="date" value={assignmentForm.endDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, endDate: event.target.value }))} /></label>
            <label>Statut<select value={assignmentForm.status} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, status: event.target.value }))}>{ASSIGNMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="form-grid-span-full">Commentaire<input value={assignmentForm.comment} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">Creer affectation</button></div>
          </form>
          <div className="table-wrap">
            <table><thead><tr><th>Salle</th><th>Type</th><th>Classe</th><th>Matiere</th><th>Cursus</th><th>Annee</th><th>Periode</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>{selectedAssignments.length === 0 ? <tr><td colSpan={9} className="empty-row">Aucune affectation.</td></tr> : selectedAssignments.map((item) => (
                <tr key={item.id}><td>{item.roomLabel}</td><td>{assignmentTypeLabel(item.assignmentType)}</td><td>{item.classLabel || item.levelLabel || item.cycleLabel || "-"}</td><td>{item.subjectLabel || "-"}</td><td>{trackLabel(item.track)}</td><td>{item.schoolYearCode}</td><td>{item.periodLabel || "-"}</td><td>{item.status}</td><td><button type="button" className="button-ghost" onClick={() => void archiveResource(`/rooms/assignments/${item.id}`, "Affectation salle archivee.")}>Archiver</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "availability" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Disponibilites</p><h2>Reservations, maintenance et indisponibilites</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitAvailability}>
            <label>Salle<select value={availabilityForm.roomId} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, roomId: event.target.value }))} required><option value="">Choisir</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code} - {room.name}</option>)}</select></label>
            <label>Jour<select value={availabilityForm.dayOfWeek} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}><option value="">Tous</option>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={String(day)}>{dayLabel(day)}</option>)}</select></label>
            <label>Debut<input type="time" value={availabilityForm.startTime} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, startTime: event.target.value }))} /></label>
            <label>Fin<input type="time" value={availabilityForm.endTime} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, endTime: event.target.value }))} /></label>
            <label>Type<select value={availabilityForm.availabilityType} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, availabilityType: event.target.value }))}>{AVAILABILITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label>Annee scolaire<select value={availabilityForm.schoolYearId} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}><option value="">Toutes</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.label || year.code}</option>)}</select></label>
            <label>Periode<select value={availabilityForm.periodId} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, periodId: event.target.value }))}><option value="">Optionnelle</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}</select></label>
            <label className="form-grid-span-full">Commentaire<input value={availabilityForm.comment} onChange={(event) => setAvailabilityForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">Ajouter disponibilite</button></div>
          </form>
          <div className="table-wrap">
            <table><thead><tr><th>Salle</th><th>Jour</th><th>Debut</th><th>Fin</th><th>Type</th><th>Annee</th><th>Periode</th><th>Action</th></tr></thead>
              <tbody>{selectedAvailabilities.length === 0 ? <tr><td colSpan={8} className="empty-row">Aucune disponibilite.</td></tr> : selectedAvailabilities.map((item) => (
                <tr key={item.id}><td>{item.roomLabel}</td><td>{dayLabel(item.dayOfWeek)}</td><td>{item.startTime || "-"}</td><td>{item.endTime || "-"}</td><td>{item.availabilityType}</td><td>{item.schoolYearCode || "-"}</td><td>{item.periodLabel || "-"}</td><td><button type="button" className="button-ghost" onClick={() => void archiveResource(`/rooms/availabilities/${item.id}`, "Disponibilite supprimee.")}>Supprimer</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "occupancy" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Occupation</p><h2>Synthese par salle</h2></div></div>
          <div className="table-wrap">
            <table><thead><tr><th>Salle</th><th>Type</th><th>Capacite</th><th>Cursus</th><th>Affect.</th><th>FR</th><th>AR</th><th>Partage</th><th>Classes</th><th>Matieres</th><th>Statut</th></tr></thead>
              <tbody>{occupancy.length === 0 ? <tr><td colSpan={11} className="empty-row">Aucune occupation calculee.</td></tr> : occupancy.map((item) => (
                <tr key={item.roomId}><td>{item.roomLabel}</td><td>{item.roomTypeName || "-"}</td><td>{item.capacity}</td><td>{item.isSharedBetweenCurricula ? "Partagee" : trackLabel(item.defaultTrack)}</td><td>{item.assignmentsCount}</td><td>{item.francophoneAssignmentsCount}</td><td>{item.arabophoneAssignmentsCount}</td><td>{item.sharedAssignmentsCount}</td><td>{item.classes.join(", ") || "-"}</td><td>{item.subjects.join(", ") || "-"}</td><td>{item.status}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "types" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Typologie</p><h2>Types de salles</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitRoomType}>
            <label>Code<input value={roomTypeForm.code} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, code: event.target.value }))} required placeholder="CLASSROOM" /></label>
            <label>Nom<input value={roomTypeForm.name} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, name: event.target.value }))} required placeholder="Salle de classe" /></label>
            <label>Statut<select value={roomTypeForm.status} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, status: event.target.value }))}>{ROOM_TYPE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="form-grid-span-full">Description<input value={roomTypeForm.description} onChange={(event) => setRoomTypeForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
            <div className="actions"><button type="submit">Ajouter type</button></div>
          </form>
          <div className="table-wrap">
            <table><thead><tr><th>Code</th><th>Nom</th><th>Description</th><th>Statut</th></tr></thead>
              <tbody>{roomTypes.length === 0 ? <tr><td colSpan={4} className="empty-row">Aucun type de salle.</td></tr> : roomTypes.map((type) => (
                <tr key={type.id}><td>{type.code}</td><td>{type.name}</td><td>{type.description || "-"}</td><td>{type.status}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}
      </div>
    </WorkflowGuide>
  );
}
