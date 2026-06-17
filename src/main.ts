import "./assets/styles/global.css";
import { mountAdminApp } from "./apps/admin/admin-app";
import { mountMainApp } from "./apps/main/main-app";

const mainRoot = document.querySelector<HTMLElement>("#app");
const adminRoot = document.querySelector<HTMLElement>("#admin-app");

if (mainRoot) {
  mountMainApp(mainRoot);
}

if (adminRoot) {
  mountAdminApp(adminRoot);
}

if (!mainRoot && !adminRoot) {
  throw new Error("CRIT Assistance root element was not found.");
}
