// @flow strict

import * as React from "react";
import type {FieldLink, ClientErrors, ExternalErrors, Err} from "./types";
import {FormContext} from "./Form";
import {getExtras} from "./formState";

function flattenErrors(errors: Err) {
  let flatErrors = [];
  if (errors.client !== "pending") {
    flatErrors = flatErrors.concat(errors.client);
  }
  if (errors.external !== "unchecked") {
    flatErrors = flatErrors.concat(errors.external);
  }
  return flatErrors;
}

type Props<T> = {|
  +link: FieldLink<T>,
  +children: ({
    shouldShowErrors: boolean,
    client: ClientErrors,
    external: ExternalErrors,
    flattened: Array<string>,
  }) => React.Node,
|};
export default function ErrorsHelper<T>(props: Props<T>): React.Node {
  const {errors, meta} = getExtras(props.link.formState);
  const flattened = flattenErrors(errors);
  const formContext = React.useContext(FormContext);
  const shouldShowErrors = formContext.shouldShowError(meta);
  return props.children({
    shouldShowErrors,
    client: errors.client,
    external: errors.external,
    flattened,
  });
}
