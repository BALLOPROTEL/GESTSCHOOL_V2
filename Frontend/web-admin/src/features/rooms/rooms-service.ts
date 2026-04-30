import { parseApiError } from "../../shared/services/api-errors";
import type {
  RoomAssignmentRecord,
  RoomAvailabilityRecord,
  RoomDetailRecord,
  RoomOccupancyRecord,
  RoomRecord,
  RoomTypeRecord
} from "../../shared/types/app";

type ApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type RoomFilters = {
  search: string;
  status: string;
  roomTypeId: string;
  track: string;
  minCapacity: string;
};

export type RoomPayload = Record<string, string | number | boolean | undefined>;

export type RoomsModuleData = {
  rooms: RoomRecord[];
  roomTypes: RoomTypeRecord[];
  assignments: RoomAssignmentRecord[];
  availabilities: RoomAvailabilityRecord[];
  occupancy: RoomOccupancyRecord[];
};

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as T;
};

const toQueryString = (values: Record<string, string | undefined>): string => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return query.toString();
};

export const fetchRoomsModule = async (
  api: ApiClient,
  schoolYearId?: string
): Promise<RoomsModuleData> => {
  const occupancyQuery = schoolYearId ? `?schoolYearId=${encodeURIComponent(schoolYearId)}` : "";
  const [roomsResponse, typesResponse, assignmentsResponse, availabilitiesResponse, occupancyResponse] =
    await Promise.all([
      api("/rooms"),
      api("/rooms/types"),
      api("/rooms/assignments"),
      api("/rooms/availabilities"),
      api(`/rooms/occupancy${occupancyQuery}`)
    ]);

  return {
    rooms: await readJson<RoomRecord[]>(roomsResponse),
    roomTypes: await readJson<RoomTypeRecord[]>(typesResponse),
    assignments: await readJson<RoomAssignmentRecord[]>(assignmentsResponse),
    availabilities: await readJson<RoomAvailabilityRecord[]>(availabilitiesResponse),
    occupancy: await readJson<RoomOccupancyRecord[]>(occupancyResponse)
  };
};

export const fetchRooms = async (api: ApiClient, filters: RoomFilters): Promise<RoomRecord[]> => {
  const query = toQueryString(filters);
  return readJson<RoomRecord[]>(await api(`/rooms${query ? `?${query}` : ""}`));
};

export const fetchRoomDetail = async (api: ApiClient, roomId: string): Promise<RoomDetailRecord> =>
  readJson<RoomDetailRecord>(await api(`/rooms/${roomId}`));

export const saveRoom = async (
  api: ApiClient,
  roomId: string | null,
  payload: RoomPayload
): Promise<RoomRecord> => {
  const response = await api(roomId ? `/rooms/${roomId}` : "/rooms", {
    method: roomId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return readJson<RoomRecord>(response);
};

export const createRoomAssignment = async (api: ApiClient, payload: RoomPayload): Promise<RoomAssignmentRecord> =>
  readJson<RoomAssignmentRecord>(
    await api("/rooms/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

export const createRoomAvailability = async (
  api: ApiClient,
  payload: RoomPayload
): Promise<RoomAvailabilityRecord> =>
  readJson<RoomAvailabilityRecord>(
    await api("/rooms/availabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

export const createRoomType = async (api: ApiClient, payload: RoomPayload): Promise<RoomTypeRecord> =>
  readJson<RoomTypeRecord>(
    await api("/rooms/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

export const deleteRoomResource = async (api: ApiClient, path: string): Promise<void> => {
  const response = await api(path, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseApiError(response));
};
