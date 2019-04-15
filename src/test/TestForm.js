// @flow

import * as React from "react";

import {FormContext, type FormContextPayload} from "../Form";

type Props = {
  ...FormContextPayload,
  children: React.Node,
};

export default function TestForm({
  children,
  shouldShowError = () => true,
  pristine = false,
  submitted = true,
  registerValidation = () => ({replace: () => {}, unregister: () => {}}),
  validateFormStateAtPath = (path, x) => x,
  validateAtPath = () => [],
}: Props = {}) {
  return (
    <FormContext.Provider
      value={{
        shouldShowError,
        pristine,
        submitted,
        registerValidation,
        validateFormStateAtPath,
        validateAtPath,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}
