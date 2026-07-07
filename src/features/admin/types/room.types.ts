export interface RoomDto {
  id: string;
  clinicId: string;
  clinicName?: string;
  name: string;
  capacity?: number | null;
  status: "active" | "inactive";
}
