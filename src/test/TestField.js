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
  validation?: Validation<string>,
|};

const TestField = (props: Props) => {
  const validation = props.validation || alwaysValid;

  return (
    <Field link={props.link} validation={validation}>
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
};

export default TestField;
