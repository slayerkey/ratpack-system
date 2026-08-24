/* Preserve companion-provided avatar URLs through the existing roster normalizer. */
var __packratBaseNormalizeMember = normalizeMember;
normalizeMember = function (raw, order) {
  var normalized = __packratBaseNormalizeMember(raw, order);
  if (raw && raw.avatar_url) normalized.avatar_url = String(raw.avatar_url);
  if (raw && raw.user && raw.user.avatar_url && normalized.user) normalized.user.avatar_url = String(raw.user.avatar_url);
  return normalized;
};
