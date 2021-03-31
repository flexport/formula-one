// @flow strict

import * as React from "react";
import type {FieldLink, Validation, Err, AdditionalRenderInfo} from "./types";
import {mapRoot} from "./shapedTree";
import {
  FormContext,
  type FormContextPayload,
  type ValidationOps,
  validationFnNoOps,
} from "./Form";
import {setExtrasBlurred, getExtras, isValid} from "./formState";
import alwaysValid from "./alwaysValid";
import {pathEqual} from "./tree";

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
  if (errors.external !== "unchecked") {
    flatErrors = flatErrors.concat(errors.external);
  }
  return flatErrors;
}

export default class Field<T> extends React.Component<Props<T>> {
  static defaultProps: {|validation: <T>(_x: T) => Array<string>|} = {
    validation: alwaysValid,
  };
  static contextType: React.Context<FormContextPayload<mixed>> = FormContext;
  context: FormContextPayload<T>;

  validationFnOps: ValidationOps<T> = validationFnNoOps();

  componentDidMount() {
    this.validationFnOps = this.context.registerValidation(
      this.props.link.path,
      this.props.validation
    );
  }

  componentDidUpdate(prevProps: Props<T>) {
    if (!pathEqual(prevProps.link.path, this.props.link.path)) {
      this.validationFnOps.unregister();
      this.validationFnOps = this.context.registerValidation(
        this.props.link.path,
        this.props.validation
      );
    } else {
      // This is a noop if the function hasn't changed
      this.validationFnOps.replace(this.props.validation);
    }
  }

  componentWillUnmount() {
    this.validationFnOps.unregister();
    this.validationFnOps = validationFnNoOps();
  }

  onChange: T => void = (newValue: T) => {
    const {
      path,
      formState: [_, oldTree],
      onChange,
    } = this.props.link;
    const newFormState = this.context.applyChangeToNode(path, [
      newValue,
      oldTree,
    ]);
    onChange(newFormState);
  };

  onBlur: () => void = () => {
    const [_, tree] = this.props.link.formState;

    this.props.link.onBlur(
      // TODO(zach): Not sure if we should blow away external errors here
      mapRoot(setExtrasBlurred, tree)
    );
  };

  render(): React.Node {
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
      blurred: meta.blurred,
      shouldShowErrors: shouldShowError(meta),
      unfilteredErrors: getErrors(errors),
      asyncValidationInFlight: false, // no validations on Form
      valid: isValid(formState),
      value,
    });
  }
}
