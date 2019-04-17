// @flow strict

import * as React from "react";

import type {
  FieldLink,
  Validation,
  Extras,
  AdditionalRenderInfo,
  CustomChange,
} from "./types";
import {cleanErrors, cleanMeta} from "./types";
import {
  type ShapedTree,
  treeFromValue,
  dangerouslyReplaceArrayChild,
  mapRoot,
  dangerouslySetChildren,
  shapedArrayChildren,
} from "./shapedTree";
import {
  removeAt,
  moveFromTo,
  insertAt,
  insertSpans,
  modify,
  zip,
  unzip,
} from "./utils/array";
import {FormContext, type ValidationOps, validationFnNoOps} from "./Form";
import {
  type FormState,
  replaceArrayChild,
  setExtrasTouched,
  arrayChild,
  getExtras,
  flatRootErrors,
  isValid,
  changedFormState,
} from "./formState";
import type {Path} from "./tree";

type ToFieldLink = <T>(T) => FieldLink<T>;
type Links<E> = Array<$Call<ToFieldLink, E>>;

type Props<E> = {|
  +link: FieldLink<Array<E>>,
  +validation: Validation<Array<E>>,
  +customChange?: CustomChange<Array<E>>,
  +children: (
    links: Links<E>,
    arrayOperations: {
      addField: (index: number, value: E) => void,
      removeField: (index: number) => void,
      moveField: (oldIndex: number, newIndex: number) => void,
      addFields: (spans: $ReadOnlyArray<[number, $ReadOnlyArray<E>]>) => void,
      filterFields: (
        predicate: (E, number, $ReadOnlyArray<E>) => boolean
      ) => void,
      modifyFields: ({
        insertSpans?: $ReadOnlyArray<[number, $ReadOnlyArray<E>]>,
        filterPredicate?: (E, number, $ReadOnlyArray<E>) => boolean,
      }) => void,
    },
    additionalInfo: AdditionalRenderInfo<Array<E>>
  ) => React.Node,
|};

function makeLinks<E>(
  path: Path,
  formState: FormState<Array<E>>,
  onChildChange: (number, FormState<E>) => void,
  onChildBlur: (number, ShapedTree<E, Extras>) => void
): Links<E> {
  const [oldValue] = formState;
  return oldValue.map((x, i) => {
    return {
      formState: arrayChild(i, formState),
      onChange: childFormState => {
        onChildChange(i, childFormState);
      },
      onBlur: childTree => {
        onChildBlur(i, childTree);
      },
      path: [...path, {type: "array", index: i}],
    };
  });
}

export default class ArrayField<E> extends React.Component<Props<E>, void> {
  static defaultProps = {
    validation: () => [],
  };
  static contextType = FormContext;

  validationFnOps: ValidationOps<Array<E>> = validationFnNoOps();

  componentDidMount() {
    this.validationFnOps = this.context.registerValidation(
      this.props.link.path,
      this.props.validation
    );
  }

  componentDidUpdate(prevProps: Props<E>) {
    if (prevProps.validation !== this.props.validation) {
      this.validationFnOps.replace(this.props.validation);
    }
  }

  componentWillUnmount() {
    this.validationFnOps.unregister();
    this.validationFnOps = validationFnNoOps();
  }

  _handleChildChange: (number, FormState<E>) => void = (
    index: number,
    newChild: FormState<E>
  ) => {
    const newFormState = replaceArrayChild(
      index,
      newChild,
      this.props.link.formState
    );

    const oldValue = this.props.link.formState[0];
    const newValue = newFormState[0];

    const customValue =
      this.props.customChange && this.props.customChange(oldValue, newValue);

    let validatedFormState: FormState<Array<E>>;
    if (customValue) {
      // Create a fresh form state for the new value.
      // TODO(zach): It's kind of gross that this is happening outside of Form.
      const nextFormState = changedFormState(customValue);

      // A custom change occurred, which means the whole array needs to be
      // revalidated.
      validatedFormState = this.context.applyValidationToTreeAtPath(
        this.props.link.path,
        nextFormState
      );
    } else {
      validatedFormState = this.context.applyValidationAtPath(
        this.props.link.path,
        newFormState
      );
    }
    this.props.link.onChange(validatedFormState);
  };

  _handleChildBlur: (number, ShapedTree<E, Extras>) => void = (
    index,
    childTree
  ) => {
    const [_, tree] = this.props.link.formState;
    this.props.link.onBlur(
      mapRoot(
        setExtrasTouched,
        dangerouslyReplaceArrayChild(index, childTree, tree)
      )
    );
  };

  _validateThenApplyChange = <E>(formState: FormState<Array<E>>) => {
    const validatedFormState = this.context.applyValidationAtPath(
      this.props.link.path,
      formState
    );
    this.props.link.onChange(validatedFormState);
  };

  _addChildField: (number, E) => void = (index: number, childValue: E) => {
    const [oldValue, oldTree] = this.props.link.formState;
    const cleanNode = {
      errors: cleanErrors,
      meta: cleanMeta,
    };

    const newValue = insertAt(index, childValue, oldValue);
    const newTree = dangerouslySetChildren(
      insertAt(
        index,
        treeFromValue(childValue, cleanNode),
        shapedArrayChildren(oldTree)
      ),
      oldTree
    );
    this._validateThenApplyChange([newValue, newTree]);
  };

  _addChildFields: (
    spans: $ReadOnlyArray<[number, $ReadOnlyArray<E>]>
  ) => void = spans => {
    const [oldValue, oldTree] = this.props.link.formState;
    const cleanNode = {
      errors: cleanErrors,
      meta: cleanMeta,
    };

    const newValue = insertSpans(spans, oldValue);
    const newNodeSpans: Array<
      [number, $ReadOnlyArray<ShapedTree<E, Extras>>]
    > = spans.map(([index, content]) => [
      index,
      content.map(v => treeFromValue(v, cleanNode)),
    ]);
    const newTree = dangerouslySetChildren(
      insertSpans(newNodeSpans, shapedArrayChildren(oldTree)),
      oldTree
    );

    this._validateThenApplyChange([newValue, newTree]);
  };

  _filterChildFields: (
    predicate: (E, number, $ReadOnlyArray<E>) => boolean
  ) => void = predicate => {
    const [oldValue, oldTree] = this.props.link.formState;
    const zipped = zip(oldValue, shapedArrayChildren(oldTree));

    const [newValue, newChildren] = unzip(
      zipped.filter(([value], i, arr) =>
        predicate(value, i, arr.map(([v]) => v))
      )
    );
    const newTree = dangerouslySetChildren(newChildren, oldTree);

    this._validateThenApplyChange([newValue, newTree]);
  };

  _modifyChildFields: ({
    insertSpans?: $ReadOnlyArray<[number, $ReadOnlyArray<E>]>,
    filterPredicate?: (E, number, $ReadOnlyArray<E>) => boolean,
  }) => void = ({insertSpans, filterPredicate}) => {
    const [oldValue, oldTree] = this.props.link.formState;
    const cleanNode = {
      errors: cleanErrors,
      meta: cleanMeta,
    };

    // TODO(zach): there's a less complicated, more functorial way to do this
    // augment, then unaugment

    const zipped = zip(oldValue, shapedArrayChildren(oldTree));

    // augment the spans with fresh nodes
    const augmentedSpans =
      insertSpans !== undefined
        ? insertSpans.map(([index, contents]) => [
            index,
            contents.map(v => [v, treeFromValue(v, cleanNode)]),
          ])
        : undefined;

    // augment the predicate to work on formstates
    const augmentedPredicate =
      filterPredicate !== undefined
        ? ([v, _], i, arr) => filterPredicate(v, i, arr.map(([v, _]) => v))
        : undefined;

    const [newValue, newChildren] = unzip(
      modify(
        {insertSpans: augmentedSpans, filterPredicate: augmentedPredicate},
        zipped
      )
    );
    const newTree = dangerouslySetChildren(newChildren, oldTree);

    this._validateThenApplyChange([newValue, newTree]);
  };

  _removeChildField = (index: number) => {
    const [oldValue, oldTree] = this.props.link.formState;

    const newValue = removeAt(index, oldValue);
    const newTree = dangerouslySetChildren(
      removeAt(index, shapedArrayChildren(oldTree)),
      oldTree
    );

    this._validateThenApplyChange([newValue, newTree]);
  };

  _moveChildField = (from: number, to: number) => {
    const [oldValue, oldTree] = this.props.link.formState;

    const newValue = moveFromTo(from, to, oldValue);
    const newTree = dangerouslySetChildren(
      moveFromTo(from, to, shapedArrayChildren(oldTree)),
      oldTree
    );

    this._validateThenApplyChange([newValue, newTree]);
  };

  render() {
    const {formState, path} = this.props.link;
    const {shouldShowError} = this.context;

    const links = makeLinks(
      path,
      formState,
      this._handleChildChange,
      this._handleChildBlur
    );
    return (
      <React.Fragment>
        {this.props.children(
          links,
          {
            addField: this._addChildField,
            removeField: this._removeChildField,
            moveField: this._moveChildField,
            addFields: this._addChildFields,
            filterFields: this._filterChildFields,
            modifyFields: this._modifyChildFields,
          },
          {
            touched: getExtras(formState).meta.touched,
            changed: getExtras(formState).meta.changed,
            shouldShowErrors: shouldShowError(getExtras(formState).meta),
            unfilteredErrors: flatRootErrors(formState),
            asyncValidationInFlight: false, // no validations on Form
            valid: isValid(formState),
            value: formState[0],
          }
        )}
      </React.Fragment>
    );
  }
}
