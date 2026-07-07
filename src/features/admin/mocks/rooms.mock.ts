import type { RoomDto } from "../types/room.types";

export const mockRooms: readonly RoomDto[] = [
  {
    id: "1",
    clinicId: "1",
    clinicName: "Clinica 1",
    name: "Consultorio 1",
    capacity: 2,
    status: "active",
  },
  {
    id: "2",
    clinicId: "1",
    clinicName: "Clinica 1",
    name: "Sala terapia",
    capacity: 4,
    status: "active",
  },
];
