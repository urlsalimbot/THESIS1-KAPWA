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
 * Whether every required document of the programs behind a case's interventions
 * has been uploaded to the case filing. The Implement HIP step (stepper 2) is not
 * considered done on an intervention alone — its program's required documents must
 * be attached. Programs without a required-documents list impose nothing.
 */
export function interventionRequirementsMet(
  interventions: any[],
  programs: any[],
  docs: any[],
): boolean {
  const programIds = [...new Set(interventions.map((i: any) => i?.programId).filter(Boolean))];
  const requiredKeys = [
    ...new Set(
      programs
        .filter((p: any) => programIds.includes(p.id) && Array.isArray(p.requiredDocuments) && p.requiredDocuments.length > 0)
        .flatMap((p: any) => p.requiredDocuments as string[]),
    ),
  ];
  if (requiredKeys.length === 0) return true;
  const uploadedKeys = new Set(docs.map((d: any) => d?.requirementKey).filter(Boolean));
  return requiredKeys.every((key) => uploadedKeys.has(key));
}
