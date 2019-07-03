// @flow

import * as React from "react";
import type {FieldLink, Validation} from "../types";
import Field from "../Field";
import alwaysValid from "../alwaysValid";

export class TestInput extends React.Component<{|
  value: string,
  errors: $ReadOnlyArray<string>,
  onChange: string => void,
  onBlur: () => void,
|}> {
  change(newValue: string) {
    this.props.onChange(newValue);
  }

  blur() {
    this.props.onBlur();
  }
  render() {
    return null;
  }
}

type Props = {|
  link: FieldLink<string>,
  validation: Validation<string>,
|};

export default class TestField extends React.Component<Props> {
  static defaultProps = {
    validation: alwaysValid,
  };

  render() {
    return (
      <Field link={this.props.link} validation={this.props.validation}>
        {(value, errors, onChange, onBlur) => (
          <TestInput
            value={value}
            errors={errors}
            onChange={onChange}
            onBlur={onBlur}
          />
        )}
      </Field>
    );
  }
}
