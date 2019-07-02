// @flow strict

import * as React from "react";
import invariant from "./utils/invariant";
import {equals as arrayEquals} from "./utils/array";
import {changedFormState} from "./formState";

import type {
  MetaField,
  OnBlur,
  Extras,
  FieldLink,
  AdditionalRenderInfo,
  Validation,
} from "./types";
import {type Direction} from "./tree";
import {
  type FormState,
  isValid,
  getExtras,
  flatRootErrors,
  freshFormState,
} from "./formState";
import {
  type ShapedTree,
  shapePath,
  updateAtPath,
  mapShapedTree,
  mapRoot,
  pathExistsInTree,
} from "./shapedTree";
import {pathFromPathString, type Path} from "./tree";
import {
  startsWith,
  encodePath,
  decodePath,
  type EncodedPath,
} from "./EncodedPath";
import FeedbackStrategies, {type FeedbackStrategy} from "./feedbackStrategies";

export type ValidationOps<T> = {
  unregister: () => void,
  replace: (fn: (T) => Array<string>) => void,
};

type FieldId = number;
type ValidationMap = Map<EncodedPath, Map<FieldId, Validation<mixed>>>;

const noOps = {
  unregister() {},
  replace() {},
};

// noOps can't be used directly because Flow doesn't typecheck a constant as
// being parametric in T.
export function validationFnNoOps<T>(): ValidationOps<T> {
  return noOps;
}

export type FormContextPayload<T> = {|
  shouldShowError: (metaField: MetaField) => boolean,
  // These values are taken into account in shouldShowError, but are also
  // available in their raw form, for convenience.
  pristine: boolean,
  submitted: boolean,
  registerValidation: (
    path: Path,
    fn: (T) => Array<string>
  ) => ValidationOps<T>,
  applyCustomChangeToTree: (Path, FormState<T>) => FormState<T>,
  applyChangeToNode: (Path, FormState<T>) => FormState<T>,
|};
export const FormContext: React.Context<
  FormContextPayload<mixed>
> = React.createContext({
  shouldShowError: () => true,
  pristine: false,
  submitted: true,
  registerValidation: () => ({replace: () => {}, unregister: () => {}}),
  applyCustomChangeToTree: (path, formState) => formState,
  applyChangeToNode: (path, formState) => formState,
});

function applyExternalErrorsToFormState<T>(
  externalErrors: null | {[path: string]: $ReadOnlyArray<string>},
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
      const newErrors = externalErrors[key];
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
        errors: {...errors, external: []},
        meta,
      }),
      oldTree
    );
  }

  return [value, tree];
}

type Value =
  | mixed
  | number
  | string
  | null
  | void
  | Array<Value>
  | {[string]: Value};

function getValueAtPath(path: Path, value: Value) {
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
      typeof value === "object" && value !== null && !Array.isArray(value),
      "Path/value shape mismatch: expected object"
    );
    return getValueAtPath(rest, value[p.key]);
  }
  throw new Error("Path is too long");
}

function pathSegmentEqual(a: Direction, b: Direction) {
  return (
    (a.type === "array" && b.type === "array" && a.index === b.index) ||
    (a.type === "object" && b.type === "object" && a.key === b.key)
  );
}

function getRelativePath(path: Path, prefix: Path) {
  for (let i = 0; i < prefix.length; i++) {
    invariant(
      pathSegmentEqual(path[i], prefix[i]),
      "Expect prefix to be a prefix of path"
    );
  }
  return path.slice(prefix.length);
}

/**
 * Deeply validates a FormState tree. Importantly, doesn't set changed metadata:
 * that is the responsibility of the caller.
 */
function validateTree<T>(
  prefix: Path,
  [value, tree]: FormState<T>,
  validations: ValidationMap
): FormState<T> {
  // TODO(dmnd): Remove the type declarations once [this flow bug][1] is fixed.
  // [1]: https://github.com/facebook/flow/issues/7881
  const entries: Array<[EncodedPath, Map<FieldId, Validation<mixed>>]> = [
    ...validations.entries(),
  ];
  const newErrors: Array<[Path, Array<string>]> = entries
    .filter(([path]) => startsWith(path, prefix))
    .map(([path, validationsMap]) => {
      // Note that value is not the root value, it's the value at this path.
      // So convert absolute validation paths to relative before attempting to
      // pull out the value on which to run them.
      const relativePath = getRelativePath(decodePath(path), prefix);
      const valueAtPath = getValueAtPath(relativePath, value);

      // Run all validation functions on valueAtPath
      const paths = [...validationsMap.values()];
      const errors = paths.reduce(
        (errors, validationFn) => errors.concat(validationFn(valueAtPath)),
        []
      );
      return [relativePath, errors];
    });

  const validatedTree = newErrors.reduce(
    (tree, [path, newErrors]) =>
      // Here we don't reset `errors: {external}` or set `meta: {touched: true,
      // changed: true}`. This is the responsibility of the caller.
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
    tree
  );

  return [value, validatedTree];
}

/**
 * Deeply updates the FormState tree to reflect a new value. Used in response
 * to a custom change.
 *
 * Note that the current implementation discards the existing tree and creates a
 * fresh form state for the new value. This initially overwrites any existing
 * `succeeded`, `touched` and `changed` values with false, losing history. For
 * most use cases this is likely desirable behaviour, but there could be uses
 * cases for which it isn't desired. We'll fix it if we encounter one of those
 * use cases.
 */
function applyCustomChangeToTree<T>(
  prefix: Path,
  [value, _tree]: FormState<T>,
  validations: ValidationMap
): FormState<T> {
  const customChangedFormState = changedFormState(value);
  return validateTree(prefix, customChangedFormState, validations);
}

// Unique id for each field so that errors can be tracked by the fields that
// produced them. This is necessary because it's possible for multiple fields
// to reference the same link "aliasing".
let _nextFieldId = 0;
function nextFieldId(): FieldId {
  return _nextFieldId++;
}

// TODO(dmnd): This function is confusing to use because pathToValue and
// validations are conceptually "absolute" (i.e. they are defined with respect
// to the root), but valueAtPath is *not* absolute: it's the value deeper in the
// tree, defined respective to pathToValue.
function validateAtPath(
  pathToValue: Path,
  valueAtPath: mixed, // TODO(dmnd): Better typechecking with ShapedPath?
  validations: ValidationMap
): Array<string> {
  const map = validations.get(encodePath(pathToValue));
  if (!map) {
    return [];
  }

  return [...map.values()].reduce(
    (errors, validationFn) => errors.concat(validationFn(valueAtPath)),
    []
  );
}

/**
 * Updates the FormState tree to reflect a new value:
 *  - run validations at path (but not child paths)
 *  - remove existing, now obsolete errors
 *  - calculate & write new client side errors
 *  - ensure that meta reflects that the value has changed
 */
function applyChangeToNode<T>(
  path: Path,
  [value, tree]: FormState<T>,
  validations: ValidationMap
): FormState<T> {
  const errors = validateAtPath(path, value, validations);
  return [
    value,
    mapRoot(
      ({meta}) => ({
        errors: {
          client: errors,
          external: "unchecked",
        },
        meta: {
          ...meta,
          succeeded: meta.succeeded || errors.length === 0,
          touched: true,
          changed: true,
        },
      }),
      tree
    ),
  ];
}

type Props<T, ExtraSubmitData> = {|
  // This is *only* used to intialize the form. Further changes will be ignored
  +initialValue: T,
  +feedbackStrategy: FeedbackStrategy,
  +onSubmit: (T, ExtraSubmitData) => void,
  +onChange: T => void,
  +onValidation: boolean => void,
  +externalErrors: null | {[path: string]: $ReadOnlyArray<string>},
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
  oldExternalErrors: null | {[path: string]: $ReadOnlyArray<string>},
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
    externalErrors: null,
  };

  static getDerivedStateFromProps(
    props: Props<T, ExtraSubmitData>,
    state: State<T>
  ) {
    if (props.externalErrors !== state.oldExternalErrors) {
      const newTree = applyExternalErrorsToFormState<T>(
        props.externalErrors,
        state.formState
      );
      return {
        formState: newTree,
        oldExternalErrors: props.externalErrors,
      };
    }
    return null;
  }

  validations: ValidationMap;
  initialValidationComplete = false;

  constructor(props: Props<T, ExtraSubmitData>) {
    super(props);

    this.validations = new Map();

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

  componentDidMount() {
    // After the the Form mounts, all validations get ran as a batch. Note that
    // this is different from how initial validations get run on all
    // subsequently mounted Fields. When a Field is mounted after the Form, its
    // validation gets run individually.
    // TODO(dmnd): It'd be nice to consolidate validation to a single code path.

    // Take care to use an updater to avoid clobbering changes from fields that
    // call onChange during cDM.
    this.setState(
      ({formState}) => ({
        formState: validateTree([], formState, this.validations),
      }),
      () => {
        this.initialValidationComplete = true;
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

  /**
   * Keeps validation errors from becoming stale when validation functions of
   * children change.
   */
  recomputeErrorsAtPathAndRender = (path: Path) => {
    this.setState(({formState: [rootValue, tree]}) => {
      const value = getValueAtPath(path, rootValue);
      const errors = validateAtPath(path, value, this.validations);
      // TODO(dmnd): succeeded isn't set here, that's probably a bug
      const updatedTree = updateAtPath(
        path,
        extras => ({...extras, errors: {...extras.errors, client: errors}}),
        tree
      );
      return {formState: [rootValue, updatedTree]};
    });
  };

  handleRegisterValidation = <NodeT>(
    path: Path,
    fn: NodeT => Array<string>
  ): ValidationOps<NodeT> => {
    // NodeT is for the benefit of callers only. Internally we have no idea what
    // type it is, so cast it to mixed for storage.
    // flowlint-next-line unclear-type:off
    const castedFn: mixed => Array<string> = (fn: any);

    const encodedPath = encodePath(path);
    let fieldId = nextFieldId();

    const map = this.validations.get(encodedPath) || new Map();

    map.set(fieldId, castedFn);
    this.validations.set(encodedPath, map);

    if (this.initialValidationComplete) {
      // Form validates all Fields at once during mount. When fields are added
      // after the Form has already mounted, their initial values need to be
      // validated.
      this.recomputeErrorsAtPathAndRender(path);
    }

    return {
      replace: (fn: NodeT => Array<string>) =>
        this.replaceValidation(path, fieldId, fn),
      unregister: () => this.unregisterValidation(path, fieldId),
    };
  };

  replaceValidation = <NodeT>(
    path: Path,
    fieldId: FieldId,
    // TODO(dmnd): It shoud be possible replace a validation function with null
    fn: NodeT => Array<string>
  ) => {
    // NodeT is for the benefit of callers only. Internally we have no idea what
    // type it is, so cast it to mixed for storage.
    // flowlint-next-line unclear-type:off
    const castedFn: mixed => Array<string> = (fn: any);

    const encodedPath = encodePath(path);
    const map = this.validations.get(encodedPath);
    invariant(map != null, "Expected to find handler map");

    const oldFn = map.get(fieldId);
    invariant(oldFn != null, "Expected to find previous validation function");
    map.set(fieldId, castedFn);

    // Now that the old validation is gone, make sure there are no left over
    // errors from it.
    const value = getValueAtPath(path, this.state.formState[0]);
    if (arrayEquals(oldFn(value), castedFn(value))) {
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

  unregisterValidation = (path: Path, fieldId: FieldId) => {
    const encodedPath = encodePath(path);
    const map = this.validations.get(encodedPath);
    invariant(map != null, "Couldn't find handler map during unregister");
    map.delete(fieldId);

    // If the entire path was deleted from the tree, any left over errors are
    // already gone. For example, this happens when an array child is removed.
    if (!pathExistsInTree(path, this.state.formState[1])) {
      return;
    }

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
          applyCustomChangeToTree: (path, formState) =>
            applyCustomChangeToTree(path, formState, this.validations),
          applyChangeToNode: (path, formState) =>
            applyChangeToNode(path, formState, this.validations),
          ...metaForm,
        }}
      >
        {this.props.children(
          {
            formState,
            onChange: this._handleChange,
            onBlur: this._handleBlur,
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
