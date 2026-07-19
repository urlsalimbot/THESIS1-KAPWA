import 'vitest-axe';

declare module '@vitest/expect' {
  interface Assertion<T> {
    toHaveNoViolations(): T;
  }
}
