const GLOB_TOKEN_PATTERN = /[*?{}[\]]/;

export function toObjectRecord(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value };
  }

  return {};
}

export function findMissingKeys(record, requiredKeys) {
  return requiredKeys.filter((key) => {
    return !(key in record);
  });
}

export function validateWorkspaceShape(pkg, requiredFields, requiredScripts) {
  const missingFields = findMissingKeys(pkg, requiredFields);
  const scripts = toObjectRecord(pkg.scripts);
  const scriptTypeValid =
    typeof pkg.scripts === 'object' &&
    pkg.scripts !== null &&
    !Array.isArray(pkg.scripts);
  const missingScripts = scriptTypeValid
    ? findMissingKeys(scripts, requiredScripts)
    : [];

  const workspacesIsArray = Array.isArray(pkg.workspaces);
  const wildcardWorkspaces = workspacesIsArray
    ? pkg.workspaces
        .map((entry) => String(entry))
        .filter((entry) => GLOB_TOKEN_PATTERN.test(entry))
    : ['<non-array-workspaces>'];

  const privateIsTrue = pkg.private === true;
  const ok =
    missingFields.length === 0 &&
    scriptTypeValid &&
    missingScripts.length === 0 &&
    workspacesIsArray &&
    wildcardWorkspaces.length === 0 &&
    privateIsTrue;

  return {
    ok,
    missingFields,
    scriptTypeValid,
    missingScripts,
    wildcardWorkspaces,
  };
}

export function validateRequiredExactEntries(currentRecord, requiredRecord) {
  const mismatches = {};

  for (const [name, expectedValue] of Object.entries(requiredRecord)) {
    if (currentRecord[name] !== expectedValue) {
      mismatches[name] = {
        expected: expectedValue,
        actual: name in currentRecord ? currentRecord[name] : null,
      };
    }
  }

  return {
    ok: Object.keys(mismatches).length === 0,
    mismatches,
  };
}
