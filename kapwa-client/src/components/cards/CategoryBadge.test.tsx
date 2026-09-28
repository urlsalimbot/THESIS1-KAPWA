import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryBadge } from './CategoryBadge';
import { ACCESS_CARD_CATEGORIES } from '@/lib/constants';

// The badge is the one place a service row's category becomes words. Three
// pages used to answer this three different ways, and two of them rendered the
// stored token verbatim — a coordinator read `community_service` where the
// category tab above read "Community Service".
describe('CategoryBadge', () => {
  it('turns a compound token into words', () => {
    render(<CategoryBadge category="community_service" />);

    expect(screen.getByText('Community Service')).toBeTruthy();
    expect(screen.queryByText('community_service')).toBeNull();
  });

  it('covers every sanctioned category, so none can reach a row as a bare token', () => {
    // A category with no badge label is one a coordinator cannot read. Walk the
    // shared vocabulary rather than a hand-written list, so adding a category
    // without a label fails here instead of on someone's card.
    for (const category of ACCESS_CARD_CATEGORIES) {
      const { unmount } = render(<CategoryBadge category={category} />);
      expect(screen.queryByText(category)).toBeNull();
      unmount();
    }
  });

  it('renders inline, because it sits inside a paragraph', () => {
    // It used to be a <div> (the shared Badge primitive) placed inside a <p>,
    // which no browser will keep as authored — React logs it as invalid nesting
    // and the HTML parser is entitled to re-parent it. A span is what inline is.
    const { container } = render(
      <p>
        <CategoryBadge category="referral" />
      </p>,
    );

    expect(container.querySelector('span')).not.toBeNull();
    expect(container.querySelector('div')).toBeNull();
  });

  it('says so when a row carries no category at all', () => {
    render(<CategoryBadge category={undefined} />);

    expect(screen.getByText('Unknown')).toBeTruthy();
  });

  it('gives a different category a different look', () => {
    // Otherwise the badge is decoration rather than information.
    const { unmount } = render(<CategoryBadge category="case_service" />);
    const first = screen.getByText('Case Service').className;
    unmount();

    render(<CategoryBadge category="compliance" />);
    expect(screen.getByText('Compliance').className).not.toBe(first);
  });

  it('still shows a category it has neither a label nor a variant for', () => {
    // Rows predate the vocabulary being closed. Falling back to the stored token
    // is the established convention here (see statusLabel) and is the better
    // failure: a category that renders as nothing hides the very row someone is
    // trying to understand.
    render(<CategoryBadge category="legacy_token" />);

    expect(screen.getByText('legacy_token')).toBeTruthy();
  });
});
