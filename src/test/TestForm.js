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
  updateTreeAtPath = (path, formState) => formState,
  updateNodeAtPath = (path, formState) => formState,
}: Props = {}) {
  return (
    <FormContext.Provider
      value={{
        shouldShowError,
        pristine,
        submitted,
        registerValidation,
        updateTreeAtPath,
        updateNodeAtPath,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}
