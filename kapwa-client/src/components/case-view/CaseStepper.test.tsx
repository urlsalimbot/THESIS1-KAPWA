import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaseStepper, stepperStepDone, stepperStatus } from './CaseStepper';

const COMMON_LABELS = [
  'Assess & Interview',
  'Program Enrollments',
  'Intervention & Requirements',
  'Inter-agency Referrals',
  'Evaluate Help Given',
  'Case Study & Closure',
];

// A done assessment: all four fields the step's predicate reads.
const doneAssessment = {
  problemsPresented: 'a',
  socialWorkerAssessment: 'b',
  clientCategory: 'c',
  caseCategory: 'd',
  status: 'enrolled',
};

describe('CaseStepper — lifecycle labels', () => {
  it('renders the six common lifecycle step labels in template order', () => {
    render(<CaseStepper currentStep="assessment" onStepClick={() => {}} caseData={{}} interventionCount={0} enrollmentCount={0} />);
    COMMON_LABELS.forEach((label, i) => {
      expect(screen.getByRole('button', { name: `${i + 1}. ${label}` })).toBeTruthy();
    });
  });

  it('injects the category step for a CICL case and puts court hearings after the referral', () => {
    render(
      <CaseStepper
        currentStep="assessment"
        onStepClick={() => {}}
        caseData={{ caseCategory: 'Children in Conflict with the Law (CICL)' }}
        interventionCount={0}
        enrollmentCount={0}
      />,
    );
    // Court hearings are reached only after the inter-agency referral, so they
    // carry the number that follows it — never slot 2.
    expect(screen.getByRole('button', { name: '1. Assess & Interview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2. Discernment Assessment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '3. Program Enrollments' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '4. Intervention & Requirements' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '5. Inter-agency Referrals' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '6. Court Hearings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '7. Evaluate Help Given' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '8. Case Study & Closure' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '2. Court Hearings' })).toBeNull();
  });
});

describe('CaseStepper — the referral count reaches the rendered step', () => {
  it('marks the referrals step done when the count says a referral was issued', () => {
    render(
      <CaseStepper
        currentStep="assessment"
        onStepClick={() => {}}
        caseData={{ ...doneAssessment, clientCategory: 'b' }}
        interventionCount={0}
        enrollmentCount={0}
        interAgencyReferralCount={1}
      />,
    );

    // The stepper marks a done step with a check and an accessible label that no
    // longer says the step is merely "not available" — asserted through the
    // check's own presence rather than a class, which Tailwind reorders.
    expect(screen.getByRole('button', { name: '4. Inter-agency Referrals' }).querySelector('svg')).toBeTruthy();
  });

  it('leaves the referrals step pending without one', () => {
    render(
      <CaseStepper currentStep="assessment" onStepClick={() => {}} caseData={doneAssessment} interventionCount={0} enrollmentCount={0} />,
    );

    expect(screen.getByRole('button', { name: '4. Inter-agency Referrals' }).querySelector('svg')).toBeNull();
  });
});

describe('stepperStepDone — Implement HIP gating', () => {
  it('requires an intervention before the interventions step completes', () => {
    expect(stepperStepDone('interventions', {}, 0, 0, {})).toBe(false);
    expect(stepperStepDone('interventions', {}, 1, 0, {})).toBe(true);
  });

  it('does not complete the interventions step until required documents are uploaded', () => {
    const caseData = { status: 'assessed' };
    expect(stepperStepDone('interventions', caseData, 1, 0, { requirementsMet: false })).toBe(false);
  });

  it('completes the interventions step once the intervention exists and requirements are met', () => {
    const caseData = { status: 'assessed' };
    expect(stepperStepDone('interventions', caseData, 1, 0, { requirementsMet: true })).toBe(true);
  });

  it('falls back to the intervention-only check when no progress data is supplied', () => {
    expect(stepperStepDone('interventions', {}, 1, 0)).toBe(true);
    expect(stepperStepDone('interventions', {}, 0, 0)).toBe(false);
  });
});

describe('stepperStepDone — Service Delivery gating', () => {
  it('is NOT done on interventions alone anymore', () => {
    expect(stepperStepDone('referrals', {}, 2, 0, {})).toBe(false);
  });

  it('is done when an inter-agency referral is issued', () => {
    expect(stepperStepDone('referrals', {}, 0, 0, { interAgencyReferralCount: 1 })).toBe(true);
  });

  it('is NOT done on a case_referrals row alone', () => {
    // The shape this predicate used to read. `case.referrals` is the transition
    // plan's agency list over `case_referrals`, not the referral the endorsement
    // letter issues, and it has 0 rows in every database this project has run —
    // so reading it left the step unsealable with no route out.
    const caseData = { referrals: [{ agencyName: 'DSWD', status: 'pending', reason: 'x' }] };
    expect(stepperStepDone('referrals', caseData, 0, 0, {})).toBe(false);
  });

  it('is done when the social worker decides a referral is not needed', () => {
    expect(stepperStepDone('referrals', {}, 0, 0, { referralNotNeeded: true })).toBe(true);
  });

  it('is NOT done when no referral exists and no decision was recorded', () => {
    const caseData = { status: 'active' };
    expect(stepperStepDone('referrals', caseData, 3, 0, { referralNotNeeded: false })).toBe(false);
  });

  // The not-needed decisions live on the case row as well as in opts, and a
  // surface that only has the case (the approval pipeline cards, the step-lock
  // bar) must read them the same way the stepper does. The fallback is inside
  // the predicate rather than at each call site for that reason.
  it('falls back to the case row when opts carries no decision', () => {
    expect(stepperStepDone('referrals', { referrals: [], referralNotNeeded: true }, 0, 0, {})).toBe(true);
    expect(stepperStepDone('interventions', { interventionNotNeeded: true }, 0, 0, {})).toBe(true);
  });

  it('lets an explicit false in opts override a true on the case row', () => {
    expect(stepperStepDone('referrals', { referrals: [], referralNotNeeded: true }, 0, 0, { referralNotNeeded: false })).toBe(false);
    expect(stepperStepDone('interventions', { interventionNotNeeded: true }, 0, 0, { interventionNotNeeded: false })).toBe(false);
  });
});

describe('stepperStepDone — enrollments', () => {
  it('is done with at least one enrollment, or the recorded decision', () => {
    expect(stepperStepDone('enrollments', { status: 'enrolled' }, 0, 1, {})).toBe(true);
    expect(stepperStepDone('enrollments', { status: 'enrolled' }, 0, 0, { enrollmentsNotNeeded: true })).toBe(true);
    expect(stepperStepDone('enrollments', { status: 'enrolled' }, 0, 0, {})).toBe(false);
    // The case-row fallback for the decision, like the other not-needed rows.
    expect(stepperStepDone('enrollments', { status: 'enrolled', enrollmentsNotNeeded: true }, 0, 0, {})).toBe(true);
  });
});

describe('stepperStepDone — category steps', () => {
  it('discernment requires the assessment date and result', () => {
    expect(stepperStepDone('discernment', { discernmentAssessedAt: '2026-10-01' }, 0, 0, {})).toBe(false);
    expect(stepperStepDone('discernment', { discernmentAssessedAt: '2026-10-01', discernmentResult: 'discerned' }, 0, 0, {})).toBe(true);
  });

  it('protection order requires the order type', () => {
    expect(stepperStepDone('protection_order', { protectionOrderType: 'Barangay Protection Order (BPO)' }, 0, 0, {})).toBe(true);
    expect(stepperStepDone('protection_order', {}, 0, 0, {})).toBe(false);
  });

  it('solo parent requires the ID issued date and number', () => {
    expect(stepperStepDone('solo_parent', { soloParentIdIssuedDate: '2026-10-01', soloParentIdNumber: 'SP-1' }, 0, 0, {})).toBe(true);
    expect(stepperStepDone('solo_parent', { soloParentIdIssuedDate: '2026-10-01' }, 0, 0, {})).toBe(false);
  });

  it('adoption requires the DVC and case-study dates', () => {
    expect(stepperStepDone('adoption', { adoptionDvcDate: '2026-10-01', adoptionCaseStudyDate: '2026-10-02' }, 0, 0, {})).toBe(true);
    expect(stepperStepDone('adoption', { adoptionDvcDate: '2026-10-01' }, 0, 0, {})).toBe(false);
  });
});

describe('CaseStepper rendering', () => {
  const baseCase = {
    ...doneAssessment,
    status: 'assessed',
    selfRelianceLevel: null,
    sustainabilityPlan: null,
    clientSignature: null,
    closureOutcome: null,
  };

  function stepButton(label: string) {
    return screen.getByText(label).closest('button')!;
  }

  it('shows the step number, not a check, when the interventions requirements are missing', () => {
    render(
      <CaseStepper currentStep="assessment" onStepClick={vi.fn()} caseData={baseCase} interventionCount={1} enrollmentCount={0} requirementsMet={false} />,
    );
    expect(stepButton('Intervention & Requirements').textContent).toContain('3');
  });

  it('shows a check on the interventions step once an intervention and all required documents exist', () => {
    render(
      <CaseStepper currentStep="assessment" onStepClick={vi.fn()} caseData={baseCase} interventionCount={2} enrollmentCount={0} requirementsMet={true} />,
    );
    const step3 = stepButton('Intervention & Requirements');
    expect(step3.textContent).not.toContain('3');
    expect(step3.querySelector('svg')).not.toBeNull();
  });

  it('shows a check on the referrals step when the referral-not-needed decision is recorded', () => {
    render(
      <CaseStepper
        currentStep="assessment"
        onStepClick={vi.fn()}
        caseData={{ ...baseCase, referralNotNeeded: true }}
        interventionCount={2}
        enrollmentCount={0}
        requirementsMet={true}
      />,
    );
    const step4 = stepButton('Inter-agency Referrals');
    expect(step4.textContent).not.toContain('4');
    expect(step4.querySelector('svg')).not.toBeNull();
  });

  it('keeps the referrals step unchecked when there is no referral and no decision recorded', () => {
    render(
      <CaseStepper currentStep="assessment" onStepClick={vi.fn()} caseData={baseCase} interventionCount={2} enrollmentCount={0} requirementsMet={true} referralNotNeeded={false} />,
    );
    expect(stepButton('Inter-agency Referrals').textContent).toContain('4');
  });

  it('marks the enrollments step done with an enrollment', () => {
    render(
      <CaseStepper currentStep="assessment" onStepClick={vi.fn()} caseData={baseCase} interventionCount={2} enrollmentCount={1} requirementsMet={true} />,
    );
    expect(stepButton('Program Enrollments').querySelector('svg')).not.toBeNull();
  });

  it('locks Evaluate Help Given when the referral step is done but the intervention step is not', () => {
    const onClick = vi.fn();
    render(
      <CaseStepper
        currentStep="referrals"
        onStepClick={onClick}
        caseData={{ ...baseCase, referralNotNeeded: true }}
        interventionCount={0}
        enrollmentCount={0}
        requirementsMet={true}
      />,
    );
    const step5 = stepButton('Evaluate Help Given');
    expect(step5.getAttribute('aria-disabled')).toBe('true');
    step5.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('unlocks Evaluate Help Given when both implementation steps are done', () => {
    const onClick = vi.fn();
    render(
      <CaseStepper
        currentStep="interventions"
        onStepClick={onClick}
        // `active` — Evaluate is Phase-Out work floored at `active`, so the floor
        // must be met for the implementation rule below to be what decides.
        caseData={{ ...baseCase, status: 'active', referralNotNeeded: true }}
        interventionCount={1}
        enrollmentCount={0}
        requirementsMet={true}
        interventionNotNeeded={false}
      />,
    );
    const step5 = stepButton('Evaluate Help Given');
    expect(step5.getAttribute('aria-disabled')).not.toBe('true');
    step5.click();
    expect(onClick).toHaveBeenCalledWith('evaluate');
  });

  // …and the same two implementation steps done *before* `active` do NOT open it:
  // the floor is a precondition, so Phase-Out work stays in Phase-Out.
  it('keeps Evaluate Help Given shut before active even when implementation is done', () => {
    render(
      <CaseStepper
        currentStep="interventions"
        onStepClick={vi.fn()}
        caseData={{ ...baseCase, status: 'in_review', referralNotNeeded: true }}
        interventionCount={1}
        enrollmentCount={0}
        requirementsMet={true}
        interventionNotNeeded={false}
      />,
    );
    expect(stepButton('Evaluate Help Given').getAttribute('aria-disabled')).toBe('true');
  });

  // The defect this pins: court hearings were reachable the moment the
  // assessment was done, so a worker recorded hearings before the case had been
  // referred out. The hearings step now sits after `referrals` in the template,
  // so it opens only once that hand-off is on the file.
  // `active`, so the Court Hearings *floor* is met and these cases isolate the
  // ordering rule (referrals before hearings) from the phase rule (hearings are
  // disabled through Phase-In). The phase rule has its own test below.
  const cicl = { ...baseCase, status: 'active', caseCategory: 'Children in Conflict with the Law (CICL)' };

  it('keeps Court Hearings locked until the inter-agency referral is done', () => {
    render(
      <CaseStepper
        currentStep="assessment"
        onStepClick={vi.fn()}
        caseData={{ ...cicl, referralNotNeeded: false }}
        interventionCount={1}
        enrollmentCount={1}
        requirementsMet={true}
      />,
    );
    // The referral step itself stays offered after the assessment — it is the
    // step this waits on — but it is not done, so the step behind it stays shut.
    expect(stepButton('Inter-agency Referrals').getAttribute('aria-disabled')).toBe('false');
    expect(stepButton('Court Hearings').getAttribute('aria-disabled')).toBe('true');
    expect(stepButton('Court Hearings').getAttribute('title')).toMatch(/Accomplish/i);
  });

  it('opens Court Hearings once the inter-agency referral is done', () => {
    const onClick = vi.fn();
    render(
      <CaseStepper
        currentStep="referrals"
        onStepClick={onClick}
        caseData={{ ...cicl, referralNotNeeded: true }}
        interventionCount={1}
        enrollmentCount={1}
        requirementsMet={true}
        referralNotNeeded
      />,
    );
    const hearings = stepButton('Court Hearings');
    expect(hearings.getAttribute('aria-disabled')).not.toBe('true');
    hearings.click();
    expect(onClick).toHaveBeenCalledWith('court_hearings');
    // …and Evaluate still waits for the hearings to be recorded.
    expect(stepButton('Evaluate Help Given').getAttribute('aria-disabled')).toBe('true');
  });

  // The phase rule, on its own. Court Hearings is implementation work and stays
  // shut for the whole of Phase-In (enrolled / assessed / in_review) *even when*
  // the referral is done — without the floor precondition the index rule would
  // open it the moment `referrals` completes, which is exactly what the ordering
  // fix on its own did not cover.
  it.each(['enrolled', 'assessed', 'in_review'])(
    'keeps Court Hearings disabled through Phase-In (%s) even once the referral is done',
    (status) => {
      render(
        <CaseStepper
          currentStep="referrals"
          onStepClick={vi.fn()}
          caseData={{ ...cicl, status, referralNotNeeded: true }}
          interventionCount={1}
          enrollmentCount={1}
          requirementsMet={true}
          referralNotNeeded
        />,
      );
      expect(stepButton('Inter-agency Referrals').getAttribute('aria-disabled')).toBe('false');
      expect(stepButton('Court Hearings').getAttribute('aria-disabled')).toBe('true');
    },
  );

  // …and the same case once it is active: the floor is met, the referral is on
  // file, and the step opens. This is the other half of the requirement.
  it.each(['active', 'transitioning'])(
    'opens Court Hearings at %s once the referral is done',
    (status) => {
      render(
        <CaseStepper
          currentStep="referrals"
          onStepClick={vi.fn()}
          caseData={{ ...cicl, status, referralNotNeeded: true }}
          interventionCount={1}
          enrollmentCount={1}
          requirementsMet={true}
          referralNotNeeded
        />,
      );
      expect(stepButton('Court Hearings').getAttribute('aria-disabled')).not.toBe('true');
    },
  );

  it('renders the CICL steps in template order within their phase groups', () => {
    render(
      <CaseStepper
        currentStep="assessment"
        onStepClick={vi.fn()}
        caseData={{ caseCategory: 'Children in Conflict with the Law (CICL)' }}
        interventionCount={0}
        enrollmentCount={0}
      />,
    );
    // Document order must equal template order: the number comes from the
    // template index while the group comes from STEP_PHASE, so a hearings step
    // left in `phaseIn` would surface as "6" inside the first group.
    const labels = [...document.querySelectorAll('nav button[aria-label]')].map(b => b.getAttribute('aria-label'));
    expect(labels).toEqual([
      '1. Assess & Interview',
      '2. Discernment Assessment',
      '3. Program Enrollments',
      '4. Intervention & Requirements',
      '5. Inter-agency Referrals',
      '6. Court Hearings',
      '7. Evaluate Help Given',
      '8. Case Study & Closure',
    ]);
  });
});

describe('stepperStepDone — Phase-Out steps require the case to reach Phase-Out', () => {
  it('does not mark Evaluate Help Given done before the case is active', () => {
    const prefilled = { status: 'in_review', selfRelianceLevel: 3, sustainabilityPlan: 'plan' };
    expect(stepperStepDone('evaluate', prefilled, 1, 0, {})).toBe(false);
    expect(stepperStepDone('evaluate', { ...prefilled, status: 'active' }, 1, 0, {})).toBe(true);
  });

  it('does not mark Case Study & Closure done before Phase-Out', () => {
    const prefilled = { status: 'active', clientSignature: 'sig', closureOutcome: 'graduated' };
    expect(stepperStepDone('closure', prefilled, 1, 0, {})).toBe(false);
    expect(stepperStepDone('closure', { ...prefilled, status: 'transitioning' }, 1, 0, {})).toBe(true);
    expect(stepperStepDone('closure', { ...prefilled, status: 'closed' }, 1, 0, {})).toBe(true);
  });

  it('does not cap steps when the status is unknown (partial payload)', () => {
    expect(stepperStepDone('evaluate', { selfRelianceLevel: 3, sustainabilityPlan: 'plan' }, 1, 0, {})).toBe(true);
  });
});

describe('stepperStatus', () => {
  it('maps each template step through stepperStepDone with progress opts', () => {
    const status = stepperStatus({ status: 'assessed' }, 1, 0, { requirementsMet: false, referralNotNeeded: true });
    expect(Object.values(status)).toEqual([false, false, false, true, false, false]);
  });

  it('includes the injected category step for a category case', () => {
    const status = stepperStatus({ status: 'assessed', caseCategory: 'Children in Conflict with the Law (CICL)' }, 0, 0, {});
    expect(Object.keys(status)).toEqual([
      'assessment', 'discernment', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
    ]);
  });
});