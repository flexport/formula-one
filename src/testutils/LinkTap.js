// @flow strict

import * as React from "react";

import type {FieldLink, Extras} from "../types";
import type {FormState} from "../formState";
import type {ShapedTree} from "../shapedTree";

type Props<T> = {|
  +link: FieldLink<T>,
  +onChange?: (value: T, meta: mixed) => void,
  +onBlur?: () => void,
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

  render() {
    const {link} = this.props;
    const tappedLink: FieldLink<T> = {
      path: link.path,
      formState: link.formState,
      onChange: this.handleChange,
      onBlur: this.handleBlur,
    };

    return this.props.children(tappedLink);
  }
}
