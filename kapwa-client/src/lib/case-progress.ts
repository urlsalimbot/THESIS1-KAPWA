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
