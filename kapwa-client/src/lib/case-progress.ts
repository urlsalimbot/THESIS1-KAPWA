/**
 * Determines whether the Assessment step is "done" for case-progress purposes.
 *
 * The FSM review gate (`validateTransition`) requires an FRVA or SWDI score before
 * a case may move assessed -> in_review. The assessment step must therefore not be
 * considered complete (locking the worker out of the DSWD Assessment Tools) until a
 * score has been captured — otherwise the worker could never enter one and the case
 * would be stuck in `assessed` forever.
 */
export function isAssessmentStepDone(caseData: any): boolean {
  return Boolean(
    caseData &&
    caseData.problemsPresented &&
    caseData.socialWorkerAssessment &&
    caseData.clientCategory &&
    (caseData.frvaScore || caseData.swdiScore),
  );
}

/**
 * Mandatory documentary needs of a program. Prefers the mandatory/optional split
 * (`requiredDocumentDetails`) and falls back to every listed document when the
 * program payload predates that field.
 */
export function mandatoryDocumentKeys(program: any): string[] {
  const details = program?.requiredDocumentDetails;
  if (Array.isArray(details) && details.length > 0) {
    return details.filter((d: any) => d?.mandatory).map((d: any) => d.key).filter(Boolean);
  }
  return Array.isArray(program?.requiredDocuments) ? program.requiredDocuments : [];
}

/** Conditional documentary needs of a program (shown, but never gating). */
export function optionalDocumentKeys(program: any): string[] {
  const details = program?.requiredDocumentDetails;
  if (!Array.isArray(details)) return [];
  return details.filter((d: any) => !d?.mandatory).map((d: any) => d.key).filter(Boolean);
}

/**
 * Whether every mandatory document of the programs behind a case's interventions
 * has been satisfied. A documentary need is satisfied when its checklist entry is
 * met — which the worker records by confirming an upload on-site (or uploading it
 * at the office), or by marking that the client passed it on-site directly.
 *
 * Keyed on `case_requirements` (the same source the server's activation gate
 * reads) so the stepper, the checklist and the gate never disagree.
 */
export function interventionRequirementsMet(
  interventions: any[],
  programs: any[],
  requirementsChecklist?: Record<string, boolean> | null,
): boolean {
  const programIds = [...new Set(interventions.map((i: any) => i?.programId).filter(Boolean))];
  const requiredKeys = [
    ...new Set(
      programs
        .filter((p: any) => programIds.includes(p.id))
        .flatMap((p: any) => mandatoryDocumentKeys(p)),
    ),
  ];
  if (requiredKeys.length === 0) return true;
  const met = requirementsChecklist || {};
  return requiredKeys.every((key) => met[key] === true);
}
