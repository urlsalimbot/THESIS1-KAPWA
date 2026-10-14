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
 * Every documentary need of a program that actually BLOCKS the seal.
 *
 * `mandatory: false` marks a conditional document ("… (if applicable)"): it is
 * still listed on the checklist for completeness, but it never holds a step
 * back — which is the worker's N/A path for a document the client cannot
 * produce (audit 3.2.12). The server's `requiredDocumentKeys` mirrors this
 * rule, and `case-step-done-fixture.json` keeps the two equal.
 */
export function requiredDocumentKeys(program: any): string[] {
  const details = program?.requiredDocumentDetails;
  if (Array.isArray(details) && details.length > 0) {
    return details.filter((d: any) => d?.mandatory !== false).map((d: any) => d?.key).filter(Boolean);
  }
  return Array.isArray(program?.requiredDocuments) ? program.requiredDocuments : [];
}

/** Every document a program lists, optional ones included — what the checklist shows. */
export function listedDocumentKeys(program: any): string[] {
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
/**
 * Every documentary need of a case with interventions: the documentary
 * requirements of the programs behind those interventions, PLUS the
 * intervention-anchored documents of every recorded intervention (independent
 * lists — but the same document KEY, e.g. 'medical_certificate', is required
 * once and satisfied once wherever it appears).
 */
export function interventionRequirementsMet(
  interventions: any[],
  programs: any[],
  requirementsChecklist?: Record<string, boolean> | null,
  crisisMode?: boolean,
  interventionDocs?: any[],
): boolean {
  const programIds = [...new Set(interventions.map((i: any) => i?.programId).filter(Boolean))];
  const requiredKeys = [
    ...new Set([
      ...programs
        .filter((p: any) => programIds.includes(p.id))
        .flatMap((p: any) => requiredDocumentKeys(p)),
      // Every recorded intervention contributes its own documentary minimum —
      // program-anchored or ad-hoc, crisis mode or not.
      ...(Array.isArray(interventionDocs)
        ? interventionDocs
            .filter((d) => interventions.some((i) => i?.interventionType && i.interventionType === d?.interventionType))
            .flatMap((d) => (d?.documentKey ? [d.documentKey] : []))
        : []),
    ]),
  ];
  if (requiredKeys.length === 0) return true;
  const met = requirementsChecklist || {};
  return requiredKeys.every((key) => met[key] === true);
}

/**
 * The enrollments step's documentary gate: the documentary requirements of the
 * enrolled programs, all met. Independent from the intervention-side list, but
 * the same key satisfied once covers both (reusability).
 */
export function enrollmentProgramRequirementsMet(
  enrollmentProgramIds: string[],
  programs: any[],
  requirementsChecklist?: Record<string, boolean> | null,
): boolean {
  const requiredKeys = [
    ...new Set(
      programs
        .filter((p: any) => enrollmentProgramIds.includes(p.id))
        .flatMap((p: any) => requiredDocumentKeys(p)),
    ),
  ];
  if (requiredKeys.length === 0) return true;
  const met = requirementsChecklist || {};
  return requiredKeys.every((key) => met[key] === true);
}
