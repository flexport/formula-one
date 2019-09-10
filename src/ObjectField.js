// @flow strict

import * as React from "react";

import type {
  FieldLink,
  Validation,
  Extras,
  AdditionalRenderInfo,
  CustomChange,
} from "./types";
import {
  FormContext,
  type FormContextPayload,
  type ValidationOps,
  validationFnNoOps,
} from "./Form";
import {
  type FormState,
  replaceObjectChild,
  setExtrasBlurred,
  objectChild,
  getExtras,
  flatRootErrors,
  isValid,
} from "./formState";
import {
  type ShapedTree,
  mapRoot,
  dangerouslyReplaceObjectChild,
} from "./shapedTree";
import {pathEqual, type Path} from "./tree";
import alwaysValid from "./alwaysValid";

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
  context: FormContextPayload<T>;
  static _contextType = FormContext;
  static defaultProps = {
    validation: alwaysValid,
  };

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
      // A custom change occurred, which means the whole object needs to be
      // revalidated.
      const customChangedFormState = [customValue, newFormState[1]];
      validatedFormState = this.context.applyCustomChangeToTree(
        this.props.link.path,
        customChangedFormState
      );
    } else {
      validatedFormState = this.context.applyChangeToNode(
        this.props.link.path,
        newFormState
      );
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
        setExtrasBlurred,
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
      <>
        {this.props.children(links, {
          touched: getExtras(formState).meta.touched,
          changed: getExtras(formState).meta.changed,
          shouldShowErrors: shouldShowError(getExtras(formState).meta),
          unfilteredErrors: flatRootErrors(formState),
          asyncValidationInFlight: false, // no validations on Form
          valid: isValid(formState),
          value: formState[0],
        })}
      </>
    );
  }
}
