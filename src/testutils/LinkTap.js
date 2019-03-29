// @flow strict

import * as React from "react";

import type {FieldLink, Extras, ClientErrors} from "../types";
import type {FormState} from "../formState";
import type {ShapedTree, ShapedPath} from "../shapedTree";

type Props<T> = {|
  +link: FieldLink<T>,
  +onChange?: (value: T, meta: mixed) => void,
  +onBlur?: () => void,
  +onValidation?: (path: ShapedPath<T>, errors: ClientErrors) => void,
  +children: (link: FieldLink<T>) => React.Node,
|};

export default class LinkTap<T> extends React.Component<Props<T>> {
  handleChange: (FormState<T>) => void = (newState: FormState<T>) => {
    if (this.props.onChange) {
      this.props.onChange(newState[0], newState[1]);
    }
    this.props.link.onChange(newState);
  };

  handleBlur: (ShapedTree<T, Extras>) => void = (
    newMeta: ShapedTree<T, Extras>
  ) => {
    if (this.props.onBlur) {
      this.props.onBlur();
    }
    this.props.link.onBlur(newMeta);
  };

  handleValidation: (ShapedPath<T>, ClientErrors) => void = (
    path: ShapedPath<T>,
    errors: ClientErrors
  ) => {
    if (this.props.onValidation) {
      this.props.onValidation(path, errors);
    }
    this.props.link.onValidation(path, errors);
  };

  render() {
    const {link} = this.props;
    const tappedLink: FieldLink<T> = {
      path: link.path,
      formState: link.formState,
      onChange: this.handleChange,
      onBlur: this.handleBlur,
      onValidation: this.handleValidation,
    };

    return this.props.children(tappedLink);
  }
}
