/** No row for requested policy_incident (db mode). */
export class BitacoraDbNotFoundError extends Error {
  constructor(message = 'No bitácora case found for this policy_incident') {
    super(message);
    this.name = 'BitacoraDbNotFoundError';
  }
}

/** DATABASE_URL missing or pool unavailable (db mode). */
export class BitacoraDbUnavailableError extends Error {
  constructor(message = 'Database is not configured') {
    super(message);
    this.name = 'BitacoraDbUnavailableError';
  }
}

/** No policy_incident query param and no rows to use as default (db mode). */
export class BitacoraDbNoDefaultError extends Error {
  constructor(
    message = 'No policy_incident query param and no cases in the database — import data or pass ?policy_incident=',
  ) {
    super(message);
    this.name = 'BitacoraDbNoDefaultError';
  }
}
