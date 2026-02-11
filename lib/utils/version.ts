const TAG_PRECEDENCE: Record<string, number> = {
  'alpha': 1,
  'beta': 2,
  'rc': 3,
  'ga': 4,
  'stable': 5, // Higher than any tag
};

/**
 * Compares two version strings.
 * Supports any number of parts (e.g., "11.13.4" vs "11.13.4.1")
 * Supports tags: alpha, beta, rc, ga.
 * Returns:
 *  - 1 if v1 > v2
 *  - -1 if v1 < v2
 *  - 0 if v1 == v2
 */
export function compareVersions(v1: string, v2: string): number {
  // Normalize separators: handle both 'dot' and 'dash'
  const p1 = v1.toLowerCase().replace(/-/g, '.').split('.');
  const p2 = v2.toLowerCase().replace(/-/g, '.').split('.');

  const length = Math.max(p1.length, p2.length);

  for (let i = 0; i < length; i++) {
    const s1 = p1[i];
    const s2 = p2[i];

    // If one side is missing a segment
    if (s1 === undefined || s2 === undefined) {
      const existing = s1 !== undefined ? s1 : s2!;
      const isTag = isNaN(Number(existing)) && TAG_PRECEDENCE[existing] !== undefined;
      
      if (isTag) {
        // Version WITHOUT tag is higher than version WITH tag (e.g. 1.0.0 > 1.0.0-rc)
        return s1 === undefined ? 1 : -1;
      } else {
        // Version WITH extra numeric segment is higher (e.g. 1.0.0.1 > 1.0.0)
        return s1 !== undefined ? 1 : -1;
      }
    }

    const n1 = Number(s1);
    const n2 = Number(s2);

    const isNum1 = !isNaN(n1);
    const isNum2 = !isNaN(n2);

    if (isNum1 && isNum2) {
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    } else if (!isNum1 && !isNum2) {
      // Both are tags
      const rank1 = TAG_PRECEDENCE[s1] || 0;
      const rank2 = TAG_PRECEDENCE[s2] || 0;
      if (rank1 > rank2) return 1;
      if (rank1 < rank2) return -1;
      // If same rank or unknown, use string comparison
      if (s1 > s2) return 1;
      if (s1 < s2) return -1;
    } else {
      // One is tag, one is number. Number segment is usually part of a version, 
      // but if we are at the same index, and one is a tag, the number is higher?
      // Actually, if we have 1.0.0.1 vs 1.0.0-rc, the number 1 is definitely head of rc.
      // But typically tags follow numbers. 1.0.0-beta. 
      // If we compare '0' (from 1.0.0) and 'beta' (from 1.0.0-beta), the number should win.
      return isNum1 ? 1 : -1;
    }
  }

  return 0;
}

export function sortVersions(versions: string[], descending = true): string[] {
  return [...versions].sort((a, b) => {
    const result = compareVersions(a, b);
    return descending ? -result : result;
  });
}
