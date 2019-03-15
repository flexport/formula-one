// @flow strict

import * as React from "react";
import {FormContext, type FormContextPayload} from "./Form";

export default function withFormContext<
  InnerProps: {+formContext: FormContextPayload},
  InnerComponent: React.ComponentType<InnerProps>
>(
  Component: InnerComponent
): Class<
  React.Component<
    $Diff<
      React.ElementConfig<InnerComponent>,
      {+formContext: FormContextPayload}
    >
  >
> {
  class WithFormContext extends React.Component<
    {forwardedRef: React.Ref<typeof Component>} & $Diff<
      InnerProps,
      {formContext: FormContextPayload}
    >
  > {
    render() {
      const {forwardedRef, ...otherProps} = this.props;
      return (
        <FormContext.Consumer>
          {formContext => (
            // $FlowFixMe looks right to me
            <Component
              {...otherProps}
              formContext={formContext}
              ref={forwardedRef}
            />
          )}
        </FormContext.Consumer>
      );
    }
  }

  // $FlowFixMe $FlowBug(0.79.1)
  return React.forwardRef((props, ref) => {
    return <WithFormContext {...props} forwardedRef={ref} />;
  });
}
