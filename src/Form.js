// @flow strict

import * as React from "react";
import invariant from "./utils/invariant";

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
import {pathFromPathString, type Path} from "./tree";
import FeedbackStrategies, {type FeedbackStrategy} from "./feedbackStrategies";

export type FormContextPayload = {
  shouldShowError: (metaField: MetaField) => boolean,
  // These values are taken into account in shouldShowError, but are also
  // available in their raw form, for convenience.
  pristine: boolean,
  submitted: boolean,
  registerValidation: (path: Path, fn: (mixed) => Array<string>) => () => void,
  validateFormStateAtPath: (Path, FormState<*>) => FormState<*>,
};
export const FormContext: React.Context<FormContextPayload> = React.createContext(
  {
    shouldShowError: () => true,
    pristine: false,
    submitted: true,
    registerValidation: () => () => {},
    validateFormStateAtPath: (path, x) => x,
  }
);

function applyServerErrorsToFormState<T>(
  serverErrors: null | {[path: string]: Array<string>},
  formState: FormState<T>
): FormState<T> {
  const [value, oldTree] = formState;

  let tree: ShapedTree<T, Extras>;
  if (serverErrors !== null) {
    // If keys do not appear, no errors
    tree = mapShapedTree(
      ({errors, meta}) => ({
        errors: {...errors, server: []},
        meta,
      }),
      oldTree
    );
    Object.keys(serverErrors).forEach(key => {
      const newErrors: Array<string> = serverErrors[key];
      const path = shapePath(value, pathFromPathString(key));

      if (path != null) {
        // TODO(zach): make some helper functions that do this
        tree = updateAtPath(
          path,
          ({errors, meta}) => ({
            errors: {...errors, server: newErrors},
            meta,
          }),
          tree
        );
      } else {
        let valueStr = JSON.stringify(value);
        if (valueStr === undefined) {
          valueStr = "undefined";
        }
        console.error(
          `Warning: couldn't match error with path ${key} to value ${valueStr}`
        );
      }
    });
  } else {
    tree = mapShapedTree(
      ({errors, meta}) => ({
        errors: {...errors, server: []},
        meta,
      }),
      oldTree
    );
  }

  return [value, tree];
}

// STOP(dmnd): Unit tests, perhaps combine with existing implementation?
type EncodedPath = string;

function encodePath(path: Path): EncodedPath {
  return (
    "/" +
    path
      .map(p => {
        if (p.type === "object") {
          return `o>${p.key}`;
        } else if (p.type === "array") {
          return `a>${p.index}`;
        } else {
          throw new Error(`Bad path type ${p.type}`);
        }
      })
      .join("/")
  );
}

function decodePath(s: EncodedPath): Path {
  return s
    .split("/")
    .filter(x => x !== "")
    .map(s => {
      const [type, val] = s.split(">");
      if (type === "o") {
        return {type: "object", key: val};
      } else if (type === "a") {
        return {type: "array", index: parseInt(val, 10)};
      } else {
        throw new Error(`Bad encoded path type '${type}' for path '${s}'`);
      }
    });
}

function getValueAtPath(
  path: Path,
  value: mixed | number | string | null | void
) {
  if (path.length === 0) {
    return value;
  }
  const [p, ...rest] = path;
  if (p.type === "array") {
    invariant(
      Array.isArray(value),
      "Path/value shape mismatch: expected array"
    );
    return getValueAtPath(rest, value[p.index]);
  } else if (p.type === "object") {
    invariant(
      typeof value === "object" && value !== null,
      "Path/value shape mismatch: expected object"
    );
    return getValueAtPath(rest, value[p.key]);
  }
  throw new Error("Path is too long");
}

function validateSubtree<T>(
  subtreePath: Path,
  formState: FormState<T>,
  validations: Map<string, (mixed) => Array<string>>
): FormState<T> {
  const newTree = [...validations.entries()]
    .filter(([path]) => path.startsWith(encodePath(subtreePath)))
    .map(([path, validation]) => {
      const parsedPath = decodePath(path);
      const val = getValueAtPath(parsedPath, formState[0]);
      const errors = validation(val);
      return [parsedPath, errors];
    })
    .reduce(
      (tree, [path, newErrors]) =>
        updateAtPath(
          path,
          ({errors, meta}) => ({
            errors: {...errors, client: newErrors},
            meta: {
              ...meta,
              succeeded: meta.succeeded || newErrors.length === 0,
            },
          }),
          tree
        ),
      formState[1]
    );

  return [formState[0], newTree];
}

type Props<T, ExtraSubmitData> = {|
  // This is *only* used to intialize the form. Further changes will be ignored
  +initialValue: T,
  +feedbackStrategy: FeedbackStrategy,
  +onSubmit: (T, ExtraSubmitData) => void,
  +onChange: T => void,
  +onValidation: boolean => void,
  +serverErrors: null | {[path: string]: Array<string>},
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
  oldServerErrors: null | {[path: string]: Array<string>},
};
export default class Form<T, ExtraSubmitData> extends React.Component<
  Props<T, ExtraSubmitData>,
  State<T>
> {
  static defaultProps = {
    onChange: () => {},
    onSubmit: () => {},
    onValidation: () => {},
    feedbackStrategy: FeedbackStrategies.Always,
    serverErrors: null,
  };

  static getDerivedStateFromProps(
    props: Props<T, ExtraSubmitData>,
    state: State<T>
  ) {
    if (props.serverErrors !== state.oldServerErrors) {
      const newTree = applyServerErrorsToFormState<T>(
        props.serverErrors,
        state.formState
      );
      return {
        formState: newTree,
        oldServerErrors: props.serverErrors,
      };
    }
    return null;
  }

  validations: Map<EncodedPath, <T>(T) => Array<string>>;

  constructor(props: Props<T, ExtraSubmitData>) {
    super(props);

    this.validations = new Map();

    const formState = applyServerErrorsToFormState(
      props.serverErrors,
      freshFormState(props.initialValue)
    );
    this.state = {
      formState,
      pristine: true,
      submitted: false,
      oldServerErrors: props.serverErrors,
    };
  }

  componentDidMount() {
    // Take care to use an updater to avoid clobbering changes from fields that
    // call onChange during cDM.
    this.setState(prevState => ({
      formState: validateSubtree([], prevState.formState, this.validations),
    }));
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

  handleRegisterValidation = (path: Path, fn: mixed => Array<string>) => {
    const encodedPath = encodePath(path);
    this.validations.set(encodedPath, fn);

    // TODO(dmnd): Remove errors (or just revalidate?) when this happens to make
    // sure an error doesn't stick around
    return () => {
      this.validations.delete(encodedPath);
    };
  };

  render() {
    const {formState} = this.state;
    const metaForm = {
      pristine: this.state.pristine,
      submitted: this.state.submitted,
    };

    return (
      <FormContext.Provider
        value={{
          shouldShowError: this.props.feedbackStrategy.bind(null, metaForm),
          registerValidation: this.handleRegisterValidation,
          validateFormStateAtPath: (path, formState) =>
            validateSubtree(path, formState, this.validations),
          ...metaForm,
        }}
      >
        {this.props.children(
          {
            formState,
            onChange: this._handleChange,
            onBlur: this._handleBlur,
            onValidation: this._handleValidation,
            path: [],
          },
          this._handleSubmit,
          {
            touched: getExtras(formState).meta.touched,
            changed: getExtras(formState).meta.changed,
            shouldShowErrors: this.props.feedbackStrategy(
              metaForm,
              getExtras(formState).meta
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
