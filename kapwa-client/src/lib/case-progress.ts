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
 * Every documentary need of a program. All intervention documents are required,
 * so the legacy `mandatory` flag is deliberately ignored: a conditional document
 * ("... (if applicable)") counts exactly like any other and must be satisfied
 * before the case can activate.
 */
export function requiredDocumentKeys(program: any): string[] {
  const details = program?.requiredDocumentDetails;
  if (Array.isArray(details) && details.length > 0) {
    return details.map((d: any) => d?.key).filter(Boolean);
  }
  return Array.isArray(program?.requiredDocuments) ? program.requiredDocuments : [];
}

/**
 * Whether every document of the programs behind a case's interventions has been
 * satisfied. A documentary need is satisfied when its checklist entry is met —
 * which the worker records by confirming an upload on-site (or uploading it at
 * the office), or by marking that the client passed it on-site directly.
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
        .flatMap((p: any) => requiredDocumentKeys(p)),
    ),
  ];
  if (requiredKeys.length === 0) return true;
  const met = requirementsChecklist || {};
  return requiredKeys.every((key) => met[key] === true);
}
