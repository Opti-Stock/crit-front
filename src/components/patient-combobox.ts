import type { CatalogItem } from "../types/operational.types";
import { escapeHtml } from "../utils/dom";

export interface PatientComboboxOption extends CatalogItem {
  badge?: string;
}

export interface RenderPatientComboboxOptions {
  id: string;
  label: string;
  query: string;
  selectedId?: string;
  hiddenName?: string;
  placeholder: string;
  isOpen: boolean;
  options: readonly PatientComboboxOption[];
  emptyMessage?: string;
  searchDataAttribute: string;
  clearDataAttribute: string;
  optionDataAttribute: string;
  optionIdDataAttribute?: string;
}

export function renderPatientCombobox(options: RenderPatientComboboxOptions): string {
  const listId = `${options.id}-options`;
  return `
    <div class="calendar-combobox-field" data-patient-combobox-root="${escapeHtml(options.id)}">
      <label for="${escapeHtml(options.id)}">${escapeHtml(options.label)}</label>
      <div class="calendar-combobox">
        <input
          id="${escapeHtml(options.id)}"
          name="patientQuery"
          type="search"
          value="${escapeHtml(options.query)}"
          placeholder="${escapeHtml(options.placeholder)}"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="${options.isOpen}"
          aria-controls="${listId}"
          ${options.searchDataAttribute}
        />
        ${options.hiddenName ? `<input type="hidden" name="${escapeHtml(options.hiddenName)}" value="${escapeHtml(options.selectedId ?? "")}" />` : ""}
        <button class="calendar-combobox__clear" type="button" ${options.clearDataAttribute} aria-label="Limpiar paciente" ${options.query ? "" : "hidden"}>x</button>
        <div id="${listId}" class="calendar-combobox__list${options.isOpen ? " calendar-combobox__list--open" : ""}" role="listbox">
          ${renderPatientComboboxOptions(options, listId)}
        </div>
      </div>
    </div>
  `;
}

export function renderPatientComboboxOptions(options: RenderPatientComboboxOptions, listId: string): string {
  if (!options.isOpen) return "";
  if (!options.query.trim()) {
    return `<div class="calendar-combobox__state">${escapeHtml(options.emptyMessage ?? "Escribe para buscar pacientes.")}</div>`;
  }
  if (options.options.length === 0) {
    return `<div class="calendar-combobox__state">Sin resultados.</div>`;
  }

  return options.options
    .map((patient, index) => {
      const label = getPatientLabel(patient);
      return `
        <button
          id="${listId}-${index}"
          class="calendar-combobox__option"
          type="button"
          role="option"
          ${options.optionDataAttribute}
          ${options.optionIdDataAttribute ? `${options.optionIdDataAttribute}="${escapeHtml(patient.id)}"` : ""}
          data-patient-option-index="${index}"
          data-patient-option-label="${escapeHtml(label)}"
        >
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(patient.badge ?? getPatientSecondaryText(patient))}</span>
        </button>
      `;
    })
    .join("");
}

export function getPatientLabel(patient: CatalogItem): string {
  return patient.fullName ?? patient.name ?? patient.id;
}

function getPatientSecondaryText(patient: CatalogItem): string {
  return patient.folio ? `Folio ${patient.folio}` : "Paciente";
}
