import "./assets/styles/global.css";
import { mountAdminApp } from "./apps/admin/admin-app";
import { mountMainApp } from "./apps/main/main-app";
import { mountSuperAdminApp } from "./apps/super-admin/super-admin-app";

const mainRoot = document.querySelector<HTMLElement>("#app");
const adminRoot = document.querySelector<HTMLElement>("#admin-app");
const superAdminRoot = document.querySelector<HTMLElement>("#super-admin-app");

if (mainRoot) {
  mountMainApp(mainRoot);
}

if (adminRoot) {
  mountAdminApp(adminRoot);
}

if (superAdminRoot) {
  mountSuperAdminApp(superAdminRoot);
}

if (!mainRoot && !adminRoot && !superAdminRoot) {
  throw new Error("CRIT Assistance root element was not found.");
}
