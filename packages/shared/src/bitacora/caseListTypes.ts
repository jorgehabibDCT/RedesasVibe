/** Compact row for case picker (GET /api/v1/bitacora/cases). Not a full BitacoraDocument. */
export interface BitacoraCaseListItem {
  policy_incident: string;
  plates: string | null;
  insured_name: string | null;
  /** ISO 8601 timestamp string */
  updated_at: string;
}

export interface BitacoraCaseListResponse {
  cases: BitacoraCaseListItem[];
}
