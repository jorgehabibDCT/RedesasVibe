function parseCsvSet(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  );
}

export interface AppAuthorizationConfig {
  allowedUserIds: Set<string>;
  allowedGroupIds: Set<string>;
}

export function getAppAuthorizationConfig(): AppAuthorizationConfig {
  return {
    allowedUserIds: parseCsvSet(process.env.PEGASUS_ALLOWED_USER_IDS),
    allowedGroupIds: parseCsvSet(process.env.PEGASUS_ALLOWED_GROUP_IDS),
  };
}

export function isAppAuthorizationEnabled(config = getAppAuthorizationConfig()): boolean {
  return config.allowedUserIds.size > 0 || config.allowedGroupIds.size > 0;
}
