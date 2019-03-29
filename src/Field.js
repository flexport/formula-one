// @flow strict

import * as React from "react";
import type {FieldLink, Validation, Err, AdditionalRenderInfo} from "./types";
import {mapRoot} from "./shapedTree";
import {FormContext} from "./Form";
import {
  setExtrasTouched,
  getExtras,
  setChanged,
  validate,
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

  unregisterValidation = () => {};

  _initialValidate() {
    const {
      link: {formState, onValidation},
      validation,
    } = this.props;
    const [value] = formState;
    const {errors} = getExtras(formState);

    if (errors.client === "pending") {
      onValidation([], validation(value));
    }
  }

  componentDidMount() {
    this.unregisterValidation = this.context.registerValidation(
      this.props.link.path,
      this.props.validation
    );

    this._initialValidate();
  }

  componentWillUnmount() {
    this.unregisterValidation();
  }

  onChange: T => void = (newValue: T) => {
    const [_, oldTree] = this.props.link.formState;
    this.props.link.onChange(
      setChanged(validate(this.props.validation, [newValue, oldTree]))
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
