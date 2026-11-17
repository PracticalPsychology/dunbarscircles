/// <reference types="@testing-library/jest-dom" />

import "@testing-library/jest-dom";

interface CustomMatchers<R extends any = any> {
  toBeInTheDocument(): R;
  toHaveTextContent(text: string | RegExp): R;
  toHaveAttribute(attr: string, value?: string): R;
  toBeVisible(): R;
  toBeDisabled(): R;
  toBeEnabled(): R;
  toHaveStyle(style: string | Record<string, any>): R;
  toHaveClass(className: string): R;
  toHaveFormValues(values: Record<string, any>): R;
  toBeEmptyDOMElement(): R;
  toBeInTheDOM(): R;
  toHaveErrorMessage(message: string): R;
  toHaveDisplayValue(value: string | string[]): R;
  toHaveNoViolations(): R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
