export const THERAPEUTIC_ATTENDANCE_SCAN_MODE = "therapeutic-attendance";

export const ATTENDANCE_SCAN_CONTRACT =
  "Contrato pendiente: apps/checkin/ debe aceptar mode=therapeutic-attendance, devolver paciente identificado y permitir resolver la cita terapeutica mas cercana por area del usuario autenticado.";

export function buildTherapeuticAttendanceScanUrl(): string {
  const params = new URLSearchParams({
    mode: THERAPEUTIC_ATTENDANCE_SCAN_MODE,
  });

  return `/apps/checkin/?${params.toString()}`;
}
