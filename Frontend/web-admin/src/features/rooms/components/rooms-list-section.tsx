import type { Dispatch, SetStateAction } from "react";

import type { RoomRecord, RoomTypeRecord } from "../../../shared/types/app";
import {
  ROOM_STATUSES,
  SCHOOL_NAME,
  TRACKS,
  type RoomFilters,
  defaultRoomFilters,
  statusLabel,
  trackLabel
} from "../rooms-screen-model";

export function RoomsListSection(props: {
  filters: RoomFilters;
  loading: boolean;
  onAddRoom: () => void;
  onArchiveRoom: (roomId: string) => void;
  onEditRoom: (room: RoomRecord) => void;
  onFilter: () => void;
  onOpenDetail: (roomId: string) => void;
  onReload: () => void;
  roomTypes: RoomTypeRecord[];
  rooms: RoomRecord[];
  setFilters: Dispatch<SetStateAction<RoomFilters>>;
}): JSX.Element {
  const {
    filters,
    loading,
    onAddRoom,
    onArchiveRoom,
    onEditRoom,
    onFilter,
    onOpenDetail,
    onReload,
    roomTypes,
    rooms,
    setFilters
  } = props;

  return (
    <section className="panel table-panel workflow-section module-modern teachers-panel">
      <div className="table-header">
        <div><p className="section-kicker">Registre salles</p><h2>Salles, capacités et usages</h2></div>
        <button type="button" onClick={onAddRoom}>Ajouter une salle</button>
      </div>
      <div className="filter-grid module-filter teachers-filter-grid">
        <label>Recherche<input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Code, nom, bâtiment" /></label>
        <label>Type<select value={filters.roomTypeId} onChange={(event) => setFilters((prev) => ({ ...prev, roomTypeId: event.target.value }))}><option value="">Tous</option>{roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label>Cursus<select value={filters.track} onChange={(event) => setFilters((prev) => ({ ...prev, track: event.target.value }))}><option value="">Tous</option>{TRACKS.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}</select></label>
        <label>Statut<select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">Tous</option>{ROOM_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
        <label>Capacité min.<input type="number" min="0" value={filters.minCapacity} onChange={(event) => setFilters((prev) => ({ ...prev, minCapacity: event.target.value }))} /></label>
        <div className="actions">
          <button type="button" onClick={onFilter}>Filtrer</button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              setFilters(defaultRoomFilters());
              onReload();
            }}
          >
            Réinitialiser
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Capacité</th><th>Cursus</th><th>Bâtiment</th><th>Occupation</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>{rooms.length === 0 ? <tr><td colSpan={9} className="empty-row">{loading ? "Chargement..." : "Aucune salle enregistrée."}</td></tr> : rooms.map((room) => (
            <tr key={room.id}>
                <td>{room.code}</td><td>{room.name}</td><td>{room.roomTypeName || "-"}</td><td>{room.capacity}</td><td>{room.isSharedBetweenCurricula ? "Partagée" : trackLabel(room.defaultTrack)}</td><td>{room.building || SCHOOL_NAME}</td><td>{room.activeAssignmentsCount ? `${room.activeAssignmentsCount} affectation(s)` : "Aucune"}</td><td><span className="status-pill">{statusLabel(room.status)}</span></td>
              <td><div className="table-actions"><button type="button" className="button-ghost" onClick={() => onOpenDetail(room.id)}>Voir</button><button type="button" className="button-ghost" onClick={() => onEditRoom(room)}>Modifier</button><button type="button" className="button-danger" onClick={() => onArchiveRoom(room.id)}>Supprimer</button></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
