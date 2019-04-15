// @flow strict

import * as React from "react";
import invariant from "./utils/invariant";
import {equals as arrayEquals} from "./utils/array";

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

export type ValidationOps<T> = {
  unregister: () => void,
  replace: (prevFn: (T) => Array<string>, nextFn: (T) => Array<string>) => void,
};

export function validationFnNoops<T>(): ValidationOps<T> {
  return {
    unregister() {},
    replace() {},
  };
}

export type FormContextPayload = {
  shouldShowError: (metaField: MetaField) => boolean,
  // These values are taken into account in shouldShowError, but are also
  // available in their raw form, for convenience.
  pristine: boolean,
  submitted: boolean,
  registerValidation: (
    path: Path,
    fn: (mixed) => Array<string>
  ) => ValidationOps<mixed>,
  validateFormStateAtPath: (Path, FormState<*>) => FormState<*>,
  validateAtPath: (path: Path, value: mixed) => Array<string>,
};
export const FormContext: React.Context<FormContextPayload> = React.createContext(
  {
    shouldShowError: () => true,
    pristine: false,
    submitted: true,
    registerValidation: () => ({replace: () => {}, unregister: () => {}}),
    validateFormStateAtPath: (path, x) => x,
    validateAtPath: () => [],
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

// TODO(dmnd): Unit tests, perhaps combine with existing implementation?
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
          (p.type: empty); // eslint-disable-line no-unused-expressions
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
  validations: Map<string, Map<number, (mixed) => Array<string>>>
): FormState<T> {
  const newTree = [...validations.entries()]
    .filter(([path]) => path.startsWith(encodePath(subtreePath)))
    .map(([path, validationsMap]) => {
      const parsedPath = decodePath(path);
      const val = getValueAtPath(parsedPath, formState[0]);

      const errors = [...validationsMap.values()].reduce(
        (errors, validationFn) => errors.concat(validationFn(val)),
        []
      );
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

// Unique id for each field so that errors can be tracked by the fields that
// produced them. This is necessary because it's possible for multiple fields
// to reference the same link "aliasing".
let _nextFieldId = 0;
function nextFieldId() {
  return _nextFieldId++;
}

function validateAtPath(
  path: Path,
  value: mixed,
  validations: Map<string, Map<number, (mixed) => Array<string>>>
): Array<string> {
  const map = validations.get(encodePath(path));
  if (!map) {
    return [];
  }

  return [...map.values()].reduce(
    (errors, validationFn) => errors.concat(validationFn(value)),
    []
  );
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

  validations: Map<EncodedPath, Map<number, (mixed) => Array<string>>>;

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
    this.setState(
      prevState => ({
        formState: validateSubtree([], prevState.formState, this.validations),
      }),
      () => {
        this.props.onValidation(isValid(this.state.formState));
      }
    );
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

  /**
   * Keeps validation errors from becoming stale when validation functions of
   * children change.
   */
  recomputeErrorsAtPathAndRender = (path: Path) => {
    this.setState(({formState: [value, meta]}) => {
      const errors = validateAtPath(path, value, this.validations);
      const updatedMeta = updateAtPath(
        path,
        extras => ({...extras, errors: {...extras.errors, client: errors}}),
        meta
      );
      return {formState: [value, updatedMeta]};
    });
  };

  handleRegisterValidation = (path: Path, fn: mixed => Array<string>) => {
    const encodedPath = encodePath(path);
    let fieldId = nextFieldId();

    const map = this.validations.get(encodedPath) || new Map();
    map.set(fieldId, fn);
    this.validations.set(encodedPath, map);

    return {
      replace: (oldFn, newFn) =>
        this.replaceValidation(path, fieldId, oldFn, newFn),
      unregister: () => this.unregisterValidation(path, fieldId),
    };
  };

  replaceValidation = (
    path: Path,
    fieldId: number,
    oldFn: mixed => Array<string>,
    newFn: mixed => Array<string>
  ) => {
    // Sanity check in case caller didn't do it
    if (oldFn === newFn) {
      return;
    }

    const encodedPath = encodePath(path);
    const map = this.validations.get(encodedPath);
    invariant(map != null, "Expected to find handler map during replace");

    const storedOldFn = map.get(fieldId);
    invariant(
      oldFn === storedOldFn,
      "Component passed incorrect existing validation function"
    );
    map.set(fieldId, newFn);

    // Now that the old validation is gone, make sure there are no left over
    // errors from it.
    const value = getValueAtPath(path, this.state.formState[0]);
    if (arrayEquals(oldFn(value), newFn(value))) {
      // The errors haven't changed, so don't bother calling setState.
      // You might think this is a silly performance optimization but actually
      // we need this for annoying React reasons:

      // If the validation function is an inline function, its identity changes
      // every render. This means replaceValidation gets called every time
      // componentDidUpdate runs (i.e. each render). Then when setState is
      // called from recomputeErrorsAtPathAndRender, it'll cause another render,
      // which causes another componentDidUpdate, and so on. So, take care to
      // avoid an infinite loop by returning early here.
      return;
    }

    // The new validation function returns different errors, so re-render.
    this.recomputeErrorsAtPathAndRender(path);
  };

  unregisterValidation = (path: Path, fieldId: number) => {
    const encodedPath = encodePath(path);
    const map = this.validations.get(encodedPath);
    invariant(map != null, "Couldn't find handler map during unregister");
    map.delete(fieldId);

    // now that the validation is gone, make sure there are no left over
    // errors from it
    this.recomputeErrorsAtPathAndRender(path);
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
          validateAtPath: (path, value) =>
            validateAtPath(path, value, this.validations),
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
