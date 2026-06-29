import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageShell } from './PageShell';

describe('PageShell', () => {
  it('renders the title text', () => {
    render(<PageShell title="Test Title">content</PageShell>);
    expect(screen.getByText('Test Title')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<PageShell title="Title" description="Test description">content</PageShell>);
    expect(screen.getByText('Test description')).toBeTruthy();
  });

  it('does not render description when omitted', () => {
    render(<PageShell title="Title">content</PageShell>);
    expect(screen.queryByText('Test description')).toBeNull();
  });

  it('renders actions slot when provided', () => {
    render(
      <PageShell title="Title" actions={<button>Action</button>}>
        content
      </PageShell>
    );
    expect(screen.getByText('Action')).toBeTruthy();
  });

  it('renders children', () => {
    render(<PageShell title="Title"><span>child content</span></PageShell>);
    expect(screen.getByText('child content')).toBeTruthy();
  });

  it('uses responsive gap classes gap-4 lg:gap-8', () => {
    const { container } = render(<PageShell title="Title">content</PageShell>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('gap-4');
    expect(wrapper.className).toContain('lg:gap-8');
  });
});
