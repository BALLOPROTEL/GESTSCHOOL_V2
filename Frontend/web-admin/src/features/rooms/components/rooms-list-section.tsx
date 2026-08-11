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
import { useI18n } from "../../../shared/i18n-context";
import { ResponsiveDataTable } from "../../../shared/components/responsive-data-table";
import { ResponsiveFilterPanel } from "../../../shared/components/responsive-filter-panel";
import { RowActionMenu } from "../../../shared/components/row-action-menu";


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
  const { t: tr } = useI18n();
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
          <p className="section-kicker">{tr("Registre salles")}</p>
          <h2>{tr("Salles, capacités et usages")}</h2>
          <p>{tr("Capacité, cursus, occupation et disponibilité des ressources physiques.")}</p>
        </div>
        <button type="button" onClick={onAddRoom}>{tr("Ajouter une salle")}</button>
      </div>
      <ResponsiveFilterPanel
        className="filter-grid module-filter teachers-filter-grid"
        title={tr("Filtres salles")}
        activeCount={Object.values(filters).filter((value) => value.trim().length > 0).length}
      >
        <label>{tr("Recherche")}<input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder={tr("Code, nom, bâtiment")} /></label>
        <label>{tr("Type")}<select value={filters.roomTypeId} onChange={(event) => setFilters((prev) => ({ ...prev, roomTypeId: event.target.value }))}><option value="">{tr("Tous")}</option>{roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label>{tr("Cursus")}<select value={filters.track} onChange={(event) => setFilters((prev) => ({ ...prev, track: event.target.value }))}><option value="">{tr("Tous")}</option>{TRACKS.map((track) => <option key={track} value={track}>{tr(trackLabel(track))}</option>)}</select></label>
        <label>{tr("Statut")}<select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">{tr("Tous")}</option>{ROOM_STATUSES.map((status) => <option key={status} value={status}>{tr(statusLabel(status))}</option>)}</select></label>
        <label>{tr("Capacité min.")}<input type="number" min="0" value={filters.minCapacity} onChange={(event) => setFilters((prev) => ({ ...prev, minCapacity: event.target.value }))} /></label>
        <div className="actions">
          <button type="button" onClick={onFilter}>{tr("Filtrer")}</button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              setFilters(defaultRoomFilters());
              onReload();
            }}
          >
            {tr("Réinitialiser")}</button>
        </div>
      </ResponsiveFilterPanel>
      <ResponsiveDataTable label={tr("Salles, capacités et usages")}>
        <table data-responsive-table="true">
          <thead><tr><th>{tr("Salle")}</th><th>{tr("Type")}</th><th>{tr("Capacité")}</th><th>{tr("Cursus")}</th><th>{tr("Bâtiment")}</th><th>{tr("Occupation")}</th><th>{tr("Statut")}</th><th aria-label={tr("Actions")}></th></tr></thead>
          <tbody>{rooms.length === 0 ? <tr><td colSpan={8} className="empty-row">{loading ? tr("Chargement...") : tr("Aucune salle enregistrée.")}</td></tr> : rooms.map((room) => (
            <tr key={room.id}>
              <td data-label={tr("Salle")}>
                <div className="v3-table-entity-cell">
                  <span className="v3-avatar">{getRoomInitials(room)}</span>
                  <div>
                    <strong>{room.name}</strong>
                    <small>{room.code}</small>
                  </div>
                </div>
              </td>
              <td data-label={tr("Type")}>{room.roomTypeName || "-"}</td>
              <td data-label={tr("Capacité")}>{room.capacity}</td>
              <td data-label={tr("Cursus")}>{room.isSharedBetweenCurricula ? tr("Partagée") : tr(trackLabel(room.defaultTrack))}</td>
              <td data-label={tr("Bâtiment")} className="v3-muted-cell">{room.building || SCHOOL_NAME}</td>
              <td data-label={tr("Occupation")}>{room.activeAssignmentsCount ? `${room.activeAssignmentsCount} affectation(s)` : tr("Aucune")}</td>
              <td data-label={tr("Statut")}><span className="status-pill">{tr(statusLabel(room.status))}</span></td>
              <td data-label={tr("Actions")}>
                <RowActionMenu
                  label={`${tr("Actions")} ${room.name}`}
                  open={openRoomActionMenuId === room.id}
                  onOpenChange={(open) => setOpenRoomActionMenuId(open ? room.id : null)}
                >
                      <button type="button" onClick={() => { setOpenRoomActionMenuId(null); onOpenDetail(room.id); }}>{tr("Voir")}</button>
                      <button type="button" onClick={() => { setOpenRoomActionMenuId(null); onEditRoom(room); }}>{tr("Modifier")}</button>
                      <button type="button" className="is-danger" onClick={() => { setOpenRoomActionMenuId(null); onArchiveRoom(room.id); }}>{tr("Supprimer")}</button>
                </RowActionMenu>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </ResponsiveDataTable>
    </section>
  );
}
