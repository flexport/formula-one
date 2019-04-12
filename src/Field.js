// @flow strict

import * as React from "react";
import type {FieldLink, Validation, Err, AdditionalRenderInfo} from "./types";
import {mapRoot} from "./shapedTree";
import {FormContext, type ValidationOps, validationFnNoops} from "./Form";
import {
  setExtrasTouched,
  getExtras,
  setChanged,
  setValidationResult,
  isValid,
} from "./formState";

type Props<T> = {|
  +link: FieldLink<T>,
  +validation: Validation<T>,
  +children: (
    value: T,
    errors: $ReadOnlyArray<string>,
    onChange: (T) => void,
    onBlur: () => void,
    additionalInfo: AdditionalRenderInfo<T>
  ) => React.Node,
|};

function getErrors(errors: Err) {
  let flatErrors = [];
  if (errors.client !== "pending") {
    flatErrors = flatErrors.concat(errors.client);
  }
  if (errors.server !== "unchecked") {
    flatErrors = flatErrors.concat(errors.server);
  }
  return flatErrors;
}

export default class Field<T> extends React.Component<Props<T>> {
  static defaultProps = {
    validation: () => [],
  };
  static contextType = FormContext;

  validationFnOps: ValidationOps<T> = validationFnNoops();

  componentDidMount() {
    this.validationFnOps = this.context.registerValidation(
      this.props.link.path,
      this.props.validation
    );
  }

  componentDidUpdate(prevProps: Props<T>) {
    if (prevProps.validation !== this.props.validation) {
      this.validationFnOps.replace(prevProps.validation, this.props.validation);
    }
  }

  componentWillUnmount() {
    this.validationFnOps.unregister();
    this.validationFnOps = validationFnNoops();
  }

  onChange: T => void = (newValue: T) => {
    const [_, oldTree] = this.props.link.formState;
    const errors = this.context.validateAtPath(this.props.link.path, newValue);

    this.props.link.onChange(
      setChanged(setValidationResult(errors, [newValue, oldTree]))
    );
  };

  onBlur = () => {
    const [_, tree] = this.props.link.formState;

    this.props.link.onBlur(
      // TODO(zach): Not sure if we should blow away server errors here
      mapRoot(setExtrasTouched, tree)
    );
  };

  render() {
    const {formState} = this.props.link;
    const [value] = formState;
    const {meta, errors} = getExtras(formState);
    const {shouldShowError} = this.context;

    const flatErrors = this.context.shouldShowError(meta)
      ? getErrors(errors)
      : [];

    return this.props.children(value, flatErrors, this.onChange, this.onBlur, {
      touched: meta.touched,
      changed: meta.changed,
      shouldShowErrors: shouldShowError(meta),
      unfilteredErrors: getErrors(errors),
      asyncValidationInFlight: false, // no validations on Form
      valid: isValid(formState),
      value,
    });
  }
}
