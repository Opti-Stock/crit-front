import type { AttendanceViewContext } from "../types/attendance-view.types";

export const PENDING_MEDICAL_NOTE_NOTIFICATION_CONTRACT =
  "Contrato pendiente: crear endpoint para notificacion pendiente de nota medica dirigida solo al terapeuta responsable y resolverla al guardar la nota.";

export async function createPendingMedicalNoteNotification(
  _context: AttendanceViewContext,
): Promise<never> {
  throw new Error(PENDING_MEDICAL_NOTE_NOTIFICATION_CONTRACT);
}

export async function resolvePendingMedicalNoteNotification(
  _context: AttendanceViewContext,
): Promise<never> {
  throw new Error(PENDING_MEDICAL_NOTE_NOTIFICATION_CONTRACT);
}
