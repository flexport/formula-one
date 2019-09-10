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
import {
  FormContext,
  type FormContextPayload,
  type ValidationOps,
  validationFnNoOps,
} from "./Form";
import {
  type FormState,
  replaceArrayChild,
  setExtrasBlurred,
  arrayChild,
  getExtras,
  flatRootErrors,
  isValid,
} from "./formState";
import {pathEqual, type Path} from "./tree";
import alwaysValid from "./alwaysValid";

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
    validation: alwaysValid,
  };
  static contextType = FormContext;
  context: FormContextPayload<Array<E>>;

  validationFnOps: ValidationOps<Array<E>> = validationFnNoOps();

  componentDidMount() {
    this.validationFnOps = this.context.registerValidation(
      this.props.link.path,
      this.props.validation
    );
  }

  componentDidUpdate(prevProps: Props<E>) {
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

  _handleChildChange: (number, FormState<E>) => void = (
    index: number,
    newChild: FormState<E>
  ) => {
    const [newValue, newTree] = replaceArrayChild(
      index,
      newChild,
      this.props.link.formState
    );

    const [oldValue, oldTree] = this.props.link.formState;
    const customValue =
      this.props.customChange && this.props.customChange(oldValue, newValue);

    if (customValue) {
      // A custom change occurred, which means the whole array needs to be
      // revalidated.
      this._customChangeChildFields(customValue, oldTree);
    } else {
      this._validateThenApplyChange([newValue, newTree]);
    }
  };

  _handleChildBlur: (number, ShapedTree<E, Extras>) => void = (
    index,
    childTree
  ) => {
    const [_, tree] = this.props.link.formState;
    this.props.link.onBlur(
      mapRoot(
        setExtrasBlurred,
        dangerouslyReplaceArrayChild(index, childTree, tree)
      )
    );
  };

  _validateThenApplyCustomChange(customChangedFormState: FormState<Array<E>>) {
    const validatedFormState = this.context.applyCustomChangeToTree(
      this.props.link.path,
      customChangedFormState
    );
    this.props.link.onChange(validatedFormState);
  }

  _validateThenApplyChange(formState: FormState<Array<E>>) {
    const validatedFormState = this.context.applyChangeToNode(
      this.props.link.path,
      formState
    );
    this.props.link.onChange(validatedFormState);
  }

  _addChildField: (number, E) => void = (index: number, childValue: E) => {
    const [oldValue, oldTree] = this.props.link.formState;

    const newValue = insertAt(index, childValue, oldValue);
    const customValue =
      this.props.customChange && this.props.customChange(oldValue, newValue);
    if (customValue) {
      this._customChangeChildFields(customValue, oldTree);
      return;
    }

    const cleanNode = {
      errors: cleanErrors,
      meta: cleanMeta,
    };

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

    const newValue = insertSpans(spans, oldValue);
    const customValue =
      this.props.customChange && this.props.customChange(oldValue, newValue);
    if (customValue) {
      this._customChangeChildFields(customValue, oldTree);
      return;
    }

    const cleanNode = {
      errors: cleanErrors,
      meta: cleanMeta,
    };

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

    const customValue =
      this.props.customChange && this.props.customChange(oldValue, newValue);

    if (customValue) {
      this._customChangeChildFields(customValue, oldTree);
    } else {
      const newTree = dangerouslySetChildren(newChildren, oldTree);
      this._validateThenApplyChange([newValue, newTree]);
    }
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

    const customValue =
      this.props.customChange && this.props.customChange(oldValue, newValue);

    if (customValue) {
      this._customChangeChildFields(customValue, oldTree);
    } else {
      const newTree = dangerouslySetChildren(newChildren, oldTree);
      this._validateThenApplyChange([newValue, newTree]);
    }
  };

  _removeChildField = (index: number) => {
    const [oldValue, oldTree] = this.props.link.formState;

    const newValue = removeAt(index, oldValue);
    const customValue =
      this.props.customChange && this.props.customChange(oldValue, newValue);

    if (customValue) {
      this._customChangeChildFields(customValue, oldTree);
    } else {
      const newTree = dangerouslySetChildren(
        removeAt(index, shapedArrayChildren(oldTree)),
        oldTree
      );
      this._validateThenApplyChange([newValue, newTree]);
    }
  };

  _moveChildField = (from: number, to: number) => {
    const [oldValue, oldTree] = this.props.link.formState;

    const newValue = moveFromTo(from, to, oldValue);
    const customValue =
      this.props.customChange && this.props.customChange(oldValue, newValue);

    if (customValue) {
      this._customChangeChildFields(customValue, oldTree);
    } else {
      const newTree = dangerouslySetChildren(
        moveFromTo(from, to, shapedArrayChildren(oldTree)),
        oldTree
      );
      this._validateThenApplyChange([newValue, newTree]);
    }
  };

  _customChangeChildFields(
    customValue: Array<E>,
    oldTree: ShapedTree<Array<E>, Extras>
  ) {
    const cleanNode = {
      errors: cleanErrors,
      meta: cleanMeta,
    };
    const newTree = dangerouslySetChildren(
      customValue.map(v => treeFromValue(v, cleanNode)),
      oldTree
    );
    this._validateThenApplyCustomChange([customValue, newTree]);
  }

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
      <>
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
      </>
    );
  }
}
