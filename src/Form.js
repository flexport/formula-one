// @flow strict

import * as React from "react";

import type {
  MetaField,
  OnBlur,
  OnValidation,
  Extras,
  FieldLink,
  ClientErrors,
  AdditionalRenderInfo,
} from "./types";
import {
  type FormState,
  isValid,
  getExtras,
  flatRootErrors,
  freshFormState,
} from "./formState";
import {
  type ShapedTree,
  type ShapedPath,
  shapePath,
  updateAtPath,
  mapShapedTree,
} from "./shapedTree";
import {pathFromPathString} from "./tree";
import strategies, {type FeedbackStrategy} from "./feedbackStrategies";

export type FormContextPayload = {
  shouldShowError: (metaField: MetaField) => boolean,
  // These values are taken into account in shouldShowError, but are also
  // available in their raw form, for convenience.
  pristine: boolean,
  submitted: boolean,
};

export const FormContext: React.Context<FormContextPayload> = React.createContext({
  shouldShowError: () => true,
  pristine: false,
  submitted: true,
});

const handleFeedbackStrategy = (
  feedbackStrategy?: FeedbackStrategy | $ReadOnlyArray<FeedbackStrategy>,
  metaForm: MetaForm,
  metaField: MetaField
): boolean => {
  if (Array.isArray(feedbackStrategy)) {
    return feedbackStrategy.some((strategy => strategy(metaForm, metaField)));
  }

  return feedbackStrategy(metaForm, metaField);
}

function applyExternalErrorsToFormState<T>(
  externalErrors: null | {[path: string]: Array<string>},
  formState: FormState<T>
): FormState<T> {
  const [value, oldTree] = formState;

  let tree: ShapedTree<T, Extras>;
  if (externalErrors !== null) {
    // If keys do not appear, no errors
    tree = mapShapedTree(
      ({errors, meta}) => ({
        errors: {...errors, external: []},
        meta,
      }),
      oldTree
    );
    Object.keys(externalErrors).forEach(key => {
      const newErrors: Array<string> = externalErrors[key];
      const path = shapePath(value, pathFromPathString(key));

      if (path != null) {
        // TODO(zach): make some helper functions that do this
        tree = updateAtPath(
          path,
          ({errors, meta}) => ({
            errors: {...errors, external: newErrors},
            meta,
          }),
          tree
        );
      } else {
        console.error(
          `Warning: couldn't match error with path ${key} to value ${JSON.stringify(
            value
          )}`
        );
      }
    });
  } else {
    tree = mapShapedTree(
      ({errors, meta}) => ({
        errors: {...errors, external: []},
        meta,
      }),
      oldTree
    );
  }

  return [value, tree];
}

type Props<T, ExtraSubmitData> = {|
  // This is *only* used to intialize the form. Further changes will be ignored
  +initialValue: T,
  +feedbackStrategy: FeedbackStrategy | $ReadOnlyArray<FeedbackStrategy>,
  +onSubmit: (T, ExtraSubmitData) => void,
  +onChange: T => void,
  +onValidation: boolean => void,
  +externalErrors: null | {[path: string]: Array<string>},
  +children: (
    link: FieldLink<T>,
    onSubmit: (ExtraSubmitData) => void,
    additionalInfo: AdditionalRenderInfo<T>
  ) => React.Node,
|};

type State<T> = {
  formState: FormState<T>,
  pristine: boolean,
  submitted: boolean,
  oldExternalErrors: null | {[path: string]: Array<string>},
};

export default class Form<T, ExtraSubmitData> extends React.Component<
  Props<T, ExtraSubmitData>,
  State<T>,
> {
  static defaultProps = {
    feedbackStrategies: strategies.Always,
    onChange: () => {},
    onSubmit: () => {},
    onValidation: () => {},
  };

  static getDerivedStateFromProps(
    props: Props<T, ExtraSubmitData>,
    state: State<T>
  ) {
    if (props.externalErrors !== state.oldExternalErrors) {
      // prettier-ignore
      const newFormState = applyExternalErrorsToFormState/*::<T>*/(
        props.externalErrors,
        state.formState
      );
      return {
        formState: newFormState,
        oldExternalErrors: props.externalErrors,
      };
    }
    return null;
  }

  constructor(props: Props<T, ExtraSubmitData>) {
    super(props);

    const formState = applyExternalErrorsToFormState(
      props.externalErrors,
      freshFormState(props.initialValue)
    );
    this.state = {
      formState,
      pristine: true,
      submitted: false,
      oldExternalErrors: props.externalErrors,
    };
  }

  // Public API: submit from the outside
  submit(extraData: ExtraSubmitData) {
    this._handleSubmit(extraData);
  }

  // private
  _handleSubmit: (extraData: ExtraSubmitData) => void = (
    extraData: ExtraSubmitData
  ) => {
    this.setState({submitted: true});
    this.props.onSubmit(this.state.formState[0], extraData);
  };

  _handleChange: (newValue: FormState<T>) => void = (
    newState: FormState<T>
  ) => {
    this.setState({formState: newState, pristine: false});
    this.props.onChange(newState[0]);
    // TODO(zach): This is a bit gross, but the general purpose here is
    //   that onValidation outside the form (in the public API) doesn't
    //   correspond directly to the internal onValidation. Internally
    //   onValidation means (on initial validation). Externally, it means
    //   on any validation.
    this.props.onValidation(isValid(newState));
  };

  _handleBlur: OnBlur<T> = (newTree: ShapedTree<T, Extras>) => {
    this.setState({
      formState: [this.state.formState[0], newTree],
    });
  };

  _handleValidation: OnValidation<T> = (
    path: ShapedPath<T>,
    errors: ClientErrors
  ) => {
    // TODO(zach): Move this into formState.js, it is gross
    const updater = newErrors => ({errors, meta}) => ({
      errors: {...errors, client: newErrors},
      meta: {
        ...meta,
        succeeded: newErrors.length === 0 ? true : meta.succeeded,
      },
    });
    this.setState(
      ({formState: [value, tree]}) => ({
        formState: [value, updateAtPath(path, updater(errors), tree)],
      }),
      () => {
        this.props.onValidation(isValid(this.state.formState));
      }
    );
  };

  render() {
    const {feedbackStrategy} = this.props;
    const {formState} = this.state;
    const metaForm = {
      pristine: this.state.pristine,
      submitted: this.state.submitted,
    };

    return (
      <FormContext.Provider
        value={{
          shouldShowError: handleFeedbackStrategy.bind(null, feedbackStrategy, metaForm),
          ...metaForm,
        }}
      >
        {this.props.children(
          {
            formState,
            onChange: this._handleChange,
            onBlur: this._handleBlur,
            onValidation: this._handleValidation,
          },
          this._handleSubmit,
          {
            touched: getExtras(formState).meta.touched,
            changed: getExtras(formState).meta.changed,
            shouldShowErrors: handleFeedbackStrategy(
              feedbackStrategy,
              metaForm,
              getExtras(formState).meta,
            ),
            unfilteredErrors: flatRootErrors(formState),
            asyncValidationInFlight: false, // no validations on Form
            valid: isValid(formState),
            value: formState[0],
          }
        )}
      </FormContext.Provider>
    );
  }
}
