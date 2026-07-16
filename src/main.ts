import "./assets/styles/global.css";
import { mountAdminApp } from "./apps/admin/admin-app";
import { mountCheckinApp } from "./apps/checkin/checkin-app";
import { mountMainApp } from "./apps/main/main-app";
import { mountSuperAdminApp } from "./apps/super-admin/super-admin-app";
import { installGlobalErrorHandling } from "./features/errors/global-errors";

installGlobalErrorHandling();

const mainRoot = document.querySelector<HTMLElement>("#app");
const adminRoot = document.querySelector<HTMLElement>("#admin-app");
const checkinRoot = document.querySelector<HTMLElement>("#checkin-app");
const superAdminRoot = document.querySelector<HTMLElement>("#super-admin-app");

if (mainRoot) {
  mountMainApp(mainRoot);
}

if (adminRoot) {
  mountAdminApp(adminRoot);
}

if (checkinRoot) {
  mountCheckinApp(checkinRoot);
}

if (superAdminRoot) {
  mountSuperAdminApp(superAdminRoot);
}

if (!mainRoot && !adminRoot && !checkinRoot && !superAdminRoot) {
  throw new Error("CRIT Assistance root element was not found.");
}
