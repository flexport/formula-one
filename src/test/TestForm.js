// @flow

import * as React from "react";

import {FormContext, type FormContextPayload} from "../Form";

// see https://github.com/facebook/flow/issues/6906#issuecomment-519723851
type BetterShape<T> = $Rest<T, {}>;

type Props = {
  ...BetterShape<FormContextPayload<mixed>>,
  children: React.Node,
};

export default function TestForm({
  children,
  shouldShowError = () => true,
  pristine = false,
  submitted = true,
  registerValidation = () => ({replace: () => {}, unregister: () => {}}),
  applyCustomChangeToTree = (path, formState) => formState,
  applyChangeToNode = (path, formState) => formState,
}: Props = {}) {
  return (
    <FormContext.Provider
      value={{
        shouldShowError,
        pristine,
        submitted,
        registerValidation,
        applyCustomChangeToTree,
        applyChangeToNode,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}
