import { useState, type Dispatch, type SetStateAction } from "react";

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

const getRoomInitials = (room: RoomRecord): string =>
  (room.code || room.name)
    .trim()
    .split(/\s+/u)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SL";

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
  const [openRoomActionMenuId, setOpenRoomActionMenuId] = useState<string | null>(null);

  return (
    <section className="panel table-panel workflow-section module-modern teachers-panel rooms-v3-table-card">
      <div className="v3-table-head">
        <div>
          <p className="section-kicker">Registre salles</p>
          <h2>Salles, capacités et usages</h2>
          <p>Capacité, cursus, occupation et disponibilité des ressources physiques.</p>
        </div>
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
        <table data-responsive-table="true">
          <thead><tr><th>Salle</th><th>Type</th><th>Capacité</th><th>Cursus</th><th>Bâtiment</th><th>Occupation</th><th>Statut</th><th aria-label="Actions"></th></tr></thead>
          <tbody>{rooms.length === 0 ? <tr><td colSpan={8} className="empty-row">{loading ? "Chargement..." : "Aucune salle enregistrée."}</td></tr> : rooms.map((room) => (
            <tr key={room.id}>
              <td data-label="Salle">
                <div className="v3-table-entity-cell">
                  <span className="v3-avatar">{getRoomInitials(room)}</span>
                  <div>
                    <strong>{room.name}</strong>
                    <small>{room.code}</small>
                  </div>
                </div>
              </td>
              <td data-label="Type">{room.roomTypeName || "-"}</td>
              <td data-label="Capacité">{room.capacity}</td>
              <td data-label="Cursus">{room.isSharedBetweenCurricula ? "Partagée" : trackLabel(room.defaultTrack)}</td>
              <td data-label="Bâtiment" className="v3-muted-cell">{room.building || SCHOOL_NAME}</td>
              <td data-label="Occupation">{room.activeAssignmentsCount ? `${room.activeAssignmentsCount} affectation(s)` : "Aucune"}</td>
              <td data-label="Statut"><span className="status-pill">{statusLabel(room.status)}</span></td>
              <td data-label="Actions">
                <div className="v3-action-cell">
                  <button
                    type="button"
                    className="v3-more-button"
                    aria-label={`Actions ${room.name}`}
                    aria-expanded={openRoomActionMenuId === room.id}
                    onClick={() => setOpenRoomActionMenuId((current) => (current === room.id ? null : room.id))}
                  >
                    <span aria-hidden="true">...</span>
                  </button>
                  {openRoomActionMenuId === room.id ? (
                    <div className="v3-action-menu" role="menu">
                      <button type="button" onClick={() => { setOpenRoomActionMenuId(null); onOpenDetail(room.id); }}>Voir</button>
                      <button type="button" onClick={() => { setOpenRoomActionMenuId(null); onEditRoom(room); }}>Modifier</button>
                      <button type="button" className="is-danger" onClick={() => { setOpenRoomActionMenuId(null); onArchiveRoom(room.id); }}>Supprimer</button>
                    </div>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
