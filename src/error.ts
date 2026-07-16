import "./assets/styles/global.css";
import { mountErrorPage } from "./features/errors/error-page";

const root = document.querySelector<HTMLElement>("#error-app");
if (root) mountErrorPage(root);
