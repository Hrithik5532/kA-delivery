/** Routes unapproved partners may access before verification is complete. */
export const UNAPPROVED_ALLOWED_SEGMENTS = new Set(['documents', 'help']);

export function isUnapprovedAllowedPath(segments: string[]): boolean {
  return segments.some((s) => UNAPPROVED_ALLOWED_SEGMENTS.has(s));
}
