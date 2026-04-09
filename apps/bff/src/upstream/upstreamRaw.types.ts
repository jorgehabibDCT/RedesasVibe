/**
 * Example upstream DTO — **not** the frontend contract.
 * Real upstreams may differ; extend mapping in `mapUpstreamToCanonical.ts`.
 */
export interface UpstreamBitacoraRaw {
  meta?: {
    environment?: string;
  };
  vehicle?: {
    deviceId?: number | string;
    vin?: string;
    year?: number;
    licensePlate?: string;
    make?: string;
    model?: string;
    color?: string;
  };
  policy?: {
    insuredName?: string;
    incidentType?: string;
    reporterName?: string;
    reporterPhone?: string;
    driverName?: string;
    policyNumber?: string;
    incidentId?: string;
    validFrom?: string;
    validTo?: string;
    insuredAmount?: number;
    agentCode?: string;
  };
  registrationOutcome?: {
    overallStatus?: string;
    success?: boolean;
    message?: string;
    deviceId?: string;
    vin?: string;
    plates?: string;
    vehicleStatus?: string;
    emergencyContact?: {
      fullName?: string;
      phone?: string;
    } | null;
  };
}
