// @flow

import * as React from "react";

import {FormContext, type FormContextPayload} from "../Form";

type Props = {
  ...$Shape<{...FormContextPayload}>,
  children: React.Node,
};

export default function TestForm({
  children,
  shouldShowError = () => true,
  pristine = false,
  submitted = true,
  registerValidation = () => ({replace: () => {}, unregister: () => {}}),
  applyValidationToTreeAtPath = (path, formState) => formState,
  applyValidationAtPath = (path, formState) => formState,
}: Props = {}) {
  return (
    <FormContext.Provider
      value={{
        shouldShowError,
        pristine,
        submitted,
        registerValidation,
        applyValidationToTreeAtPath,
        applyValidationAtPath,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}
