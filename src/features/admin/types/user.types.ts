export interface UserDto {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
  roles: { id: string; name: string }[];
}
