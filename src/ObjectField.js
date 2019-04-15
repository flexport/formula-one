// @flow strict

import * as React from "react";

import type {
  FieldLink,
  Validation,
  Extras,
  AdditionalRenderInfo,
  CustomChange,
} from "./types";
import {FormContext, type ValidationOps, validationFnNoops} from "./Form";
import {
  type FormState,
  setChanged,
  replaceObjectChild,
  setExtrasTouched,
  objectChild,
  setValidationResult,
  getExtras,
  flatRootErrors,
  isValid,
  changedFormState,
} from "./formState";
import {
  type ShapedTree,
  mapRoot,
  dangerouslyReplaceObjectChild,
} from "./shapedTree";
import type {Path} from "./tree";

type ToFieldLink = <T>(T) => FieldLink<T>;
type Links<T: {}> = $ObjMap<T, ToFieldLink>;

type Props<T: {}> = {|
  +link: FieldLink<T>,
  +validation: Validation<T>,
  +customChange?: CustomChange<T>,
  +children: (
    links: Links<T>,
    additionalInfo: AdditionalRenderInfo<T>
  ) => React.Node,
|};

function makeLinks<T: {}, V>(
  path: Path,
  formState: FormState<T>,
  onChildChange: (string, FormState<V>) => void,
  onChildBlur: (string, ShapedTree<V, Extras>) => void
): Links<T> {
  const [value] = formState;
  return Object.keys(value).reduce((memo, k) => {
    const l = {
      formState: objectChild(k, formState),
      onChange: childFormState => {
        onChildChange(k, childFormState);
      },
      onBlur: childTree => {
        onChildBlur(k, childTree);
      },
      path: [...path, {type: "object", key: k}],
    };
    memo[k] = l;
    return {
      ...memo,
      [k]: l,
    };
  }, {});
}

export default class ObjectField<T: {}> extends React.Component<
  Props<T>,
  void
> {
  static contextType = FormContext;
  static _contextType = FormContext;
  static defaultProps = {
    validation: () => [],
  };

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

  _handleChildChange: <V>(string, FormState<V>) => void = <V>(
    key: string,
    newChild: FormState<V>
  ) => {
    const newFormState = replaceObjectChild(
      key,
      newChild,
      this.props.link.formState
    );

    const oldValue = this.props.link.formState[0];
    const newValue = newFormState[0];

    const customValue =
      this.props.customChange && this.props.customChange(oldValue, newValue);

    let validatedFormState: FormState<T>;
    if (customValue) {
      // Create a fresh form state for the new value.
      // TODO(zach): It's kind of gross that this is happening outside of Form.
      const nextFormState = changedFormState(customValue);

      // A custom change occurred, which means the whole object needs to be
      // revalidated.
      validatedFormState = this.context.validateFormStateAtPath(
        this.props.link.path,
        nextFormState
      );
    } else {
      const errors = this.context.validateAtPath(
        this.props.link.path,
        newValue
      );
      const nextFormState = setChanged(newFormState);
      validatedFormState = setValidationResult(errors, nextFormState);
    }
    this.props.link.onChange(validatedFormState);
  };

  _handleChildBlur: <V>(string, ShapedTree<V, Extras>) => void = <V>(
    key: string,
    childTree: ShapedTree<V, Extras>
  ) => {
    const [_, tree] = this.props.link.formState;
    this.props.link.onBlur(
      mapRoot(
        setExtrasTouched,
        dangerouslyReplaceObjectChild(key, childTree, tree)
      )
    );
  };

  render() {
    const {formState} = this.props.link;
    const {shouldShowError} = this.context;

    const links = makeLinks(
      this.props.link.path,
      this.props.link.formState,
      this._handleChildChange,
      this._handleChildBlur
    );
    return (
      <React.Fragment>
        {this.props.children(links, {
          touched: getExtras(formState).meta.touched,
          changed: getExtras(formState).meta.changed,
          shouldShowErrors: shouldShowError(getExtras(formState).meta),
          unfilteredErrors: flatRootErrors(formState),
          asyncValidationInFlight: false, // no validations on Form
          valid: isValid(formState),
          value: formState[0],
        })}
      </React.Fragment>
    );
  }
}
