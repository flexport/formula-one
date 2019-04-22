# formula-one

**formula-one** is a library which makes it easier to write type-safe forms with validations and complex inputs.

## A minimal example, with no validation

[Edit the working example on CodeSandbox](https://codesandbox.io/s/549m5n0y8x?module=%2Fsrc%2FSimpleExample.js)

```jsx
// @flow strict

import React from "react";
import {Form, Field, ObjectField, FeedbackStrategies} from "formula-one";

type Person = {
  name: string,
  age: string,
  side: "Empire" | "Rebels",
};

const EMPTY_PERSON: Person = {
  name: "",
  age: "",
  side: "Empire",
};

export default function SimpleExample() {
  return (
    <div className="App">
      <Form
        initialValue={EMPTY_PERSON}
        onSubmit={person => console.log("Submitted", person)}
        // TODO(dmnd): Remove following props after new version is published
        serverErrors={null}
        feedbackStrategy={FeedbackStrategies.Always}
      >
        {(link, onSubmit) => (
          <ObjectField link={link}>
            {links => (
              <>
                <Field link={links.name}>
                  {(value, errors, onChange) => (
                    <label>
                      <div>Name</div>
                      <input
                        type="text"
                        value={value}
                        onChange={e => onChange(e.target.value)}
                      />
                    </label>
                  )}
                </Field>
                <Field link={links.age}>
                  {(value, errors, onChange) => (
                    <label>
                      <div>Age</div>
                      <input
                        type="text"
                        onChange={e => onChange(e.target.value)}
                        value={value}
                      />
                    </label>
                  )}
                </Field>
                <Field link={links.side}>
                  {(value, errors, onChange) => (
                    <label>
                      <div>Side</div>
                      <select
                        onChange={e => onChange(e.target.value)}
                        value={value}
                      >
                        <option value="Empire">Empire</option>
                        <option value="Rebels">Rebels</option>
                      </select>
                    </label>
                  )}
                </Field>

                <div>
                  <button onClick={onSubmit}>Submit</button>
                </div>
              </>
            )}
          </ObjectField>
        )}
      </Form>
    </div>
  );
}
```

## Philosophy

**formula-one** helps you write forms in React by managing the state of your form and ensuring your inputs are the right type. It does this by introducing a new abstraction, called a _Field_. A _Field_ wraps some value and provides a way to render and edit that value. A simple _Field_ might wrap a `string`, which displays and edits its value through an `<input type="text">`. A more complex value, such as a date and time might be displayed as an ISO 8601 string and be edited through a calendar input.

*Field*s are specified using the `<Field>` component, which wraps your input using a render prop. It provides the value, errors, onChange, and onBlur handlers, which should be hooked up to your input.

Individual *Field*s are aggregated into objects and arrays using the `<ObjectField>` and `<ArrayField>` components. These components enable you to build forms with multiple fields.

In **formula-one**, all of the form's state is held in the `<Form>` component, and communicated to its internal *Field*s via opaque props called *link*s. These links contain all of the data and metadata used to render an input and its associated errors.

<!-- something about tree here? -->

## Validations

### Simple Validation

**formula-one** provides an api for specifying validations on *Field*s. Each _Field_ exposes a `validation` props, which has the type `T => Array<string>` for a `Field` of type `T`. Each string represents an error message, and the empty array indicates no errors.

An example of a `Field<string>` which doesn't allow empty strings:

[Edit the working example on CodeSandbox](https://codesandbox.io/s/rj25l331no?module=%2Fsrc%2FNoEmptyStrings.js)

```jsx
function noEmptyStrings(s: string): Array<string> {
  if (s === "") {
    return ["Cannot be empty"];
  }
  return [];
}

<Field link={link} validation={noEmptyStrings}>
  {(value, errors, onChange) => (
    <>
      <label>
        <div>Name</div>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {errors ? (
          <ul className="error">
            {errors.map(e => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </label>
    </>
  )}
</Field>;
```

### When to show errors

In addition to tracking errors and validating when inputs change, **formula-one** tracks metadata to help you decide whether you should show errors to your user. `<Form>` allows you to specify a strategy for when to show errors.

Some base strategies are exported as fields on the `FeedbackStrategies` object. Here is a table of the strategies and their behavior.

| Strategy identifier                            | Strategy Behavior                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `FeedbackStrategies.Always`                    | Always show errors                                                                   |
| `FeedbackStrategies.Touched`                   | Show errors for fields which have been touched (changed or blurred)                  |
| `FeedbackStrategies.Changed`                   | Show errors for fields which have been changed                                       |
| `FeedbackStrategies.ClientValidationSucceeded` | Show errors for fields which have had their validations pass at any time in the past |
| `FeedbackStrategies.Pristine`                  | Show errors when the form has not been modified                                      |
| `FeedbackStrategies.Submitted`                 | Show errors after the form has been submitted                                        |

These simple strategies can be combined by using the `and`, `or`, and `not` functions also on the `FeedbackStrategies` object, as follows:

```js
import {FeedbackStrategies} from "formula-one";
const {Changed, Submitted, or} = FeedbackStrategies;
const myStrategy = or(Changed, Submitted);
```

### Multiple validations for a single `<Field>`

To specify multiple validations for a single field, simply run the validations in sequence and serialize their errors into a single array.

[Edit the working example on CodeSandbox](https://codesandbox.io/s/z32q7ml1y4?module=%2Fsrc%2FMultipleValidations.js)

```jsx
function validate(s: string): Array<string> {
  return [noEmptyStrings, mustHaveNumbers, noLongStrings].flatMap(validation =>
    validation(s)
  );
}
```

### Validations on aggregations of *Field*s

Both `<ObjectField>` and `<ArrayField>` allow a validation to be specified. You can use the `<ErrorHelper>` component to extract the errors from the link.

## Arrays in forms

Often, you may want to edit a list of items in a form. **formula-one** exposes an aggregator called `<ArrayField>`, which allows you to manipulate a list of *Field*s.

For example, imagine you have a form for a person, who has a name, but also some number of pets, who each have their own name.

[Edit the working example on CodeSandbox](https://codesandbox.io/s/xlzyz3o6no?module=%2Fsrc%2FArrays.js)

```jsx
type Person = {
  name: string,
  pets: Array<{
    name: string,
  }>,
};

const emptyPerson: Person = {
  name: "",
  pets: [],
};

export default function() {
  return (
    <div className="App">
      <Form
        initialValue={emptyPerson}
        onSubmit={p => console.log("Submitted", p)}
        // TODO(dmnd): Remove following props after new version is published
        serverErrors={null}
        feedbackStrategy={FeedbackStrategies.Always}
      >
        {(link, onSubmit) => (
          <ObjectField link={link}>
            {links => (
              <>
                <Field link={links.name}>
                  {(value, errors, onChange) => (
                    <label>
                      <div>Name</div>
                      <input
                        type="text"
                        onChange={e => onChange(e.target.value)}
                        value={value}
                      />
                    </label>
                  )}
                </Field>
                <ArrayField link={links.pets}>
                  {(links, {addField}) => (
                    <ul>
                      {links.map((link, i) => (
                        <ObjectField key={i} link={link}>
                          {link => (
                            <Field link={link.name}>
                              {(value, errors, onChange) => (
                                <li>
                                  Pet #{i + 1}
                                  <input
                                    type="text"
                                    value={value}
                                    onChange={e => onChange(e.target.value)}
                                  />
                                </li>
                              )}
                            </Field>
                          )}
                        </ObjectField>
                      ))}
                      {links.length === 0 ? "No pets :(" : null}
                      <button
                        onClick={() => addField(links.length, {name: ""})}
                      >
                        Add pet
                      </button>
                    </ul>
                  )}
                </ArrayField>
                <div>
                  <button onClick={onSubmit}>Submit</button>
                </div>
              </>
            )}
          </ObjectField>
        )}
      </Form>
    </div>
  );
}
```

<!-- TODO(dmnd) Add removeField and moveField to the example -->

`<ArrayField>` exposes both an array of links to the array elements, but also an object containing mutators for the array:

- `addField(index: number, value: T)`: Add a field at a position in the array
- `removeField(index: number)`: Remove a field at a position in array
- `moveField(fromIndex: number, toIndex: number)`: Move a field in an array (preserves metadata for the field)

## Complex inputs

Even inputs which are complex can be wrapped in a `<Field>` wrapper, but validations are tracked at the field level, so you won't be able to use **formula-one** to track changes and validations below the field level.

<!-- ### Form state vs actual model -->

## Common use cases

### Form in a modal

Oftentimes, when you need to wrap a component which has a button you will use for submission, you can simply wrap that component with your `<Form>` element. The `<Form>` does not render any elements, so it will not affect your DOM hierarchy.

Example:

```jsx
<Form>
  {(link, handleSubmit) => (
    <Modal buttons={[<button onClick={handleSubmit}>Submit</button>]}>
      <MyField link={link}>...</MyField>
    </Modal>
  )}
</Form>
```

### External validation

Oftentimes, you will want to show errors from an external source (such as the server) in your form alongside any client-side validation errors. These can be passed into your `<Form>` component using the `serverErrors` (TODO(zach): change to `externalErrors`?) prop.

These errors must be in an object with keys representing the path to the field they should be associated with. For example, the errors:

```js
const serverErrors = {
  "/": "User failed to save!",
  "/email": "A user with this email already exists!",
};
```

could be used in this form:

```jsx
<Form serverErrors={serverErrors}>
  {(link, handleSubmit) => (
  <>
    <ObjectField link={link}>
      {links => (
        <>
          <StringField link={links.name} />
          <StringField link={links.email} />
        </>
      )}
    </ObjectField>
    <button onClick={handleSubmit}>Submit</button>
  </>
  )}
</Form>
```

## Advanced usage

### Additional information in render prop

Additional information is available in an object which is the last argument to the `<Form>`, `<ObjectField>`, `<ArrayField>`, and `<Field>` components' render props. This object contains the following information:

| key                     | type                     | description                                                                                                                                                                                |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| touched                 | `boolean`                | Whether the field has been touched (blurred or changed)                                                                                                                                    |
| changed                 | `boolean`                | Whether the field has been changed                                                                                                                                                         |
| shouldShowErrors        | `boolean`                | Whether errors should be shown according to the current feedback strategy                                                                                                                  |
| unfilteredErrors        | `$ReadOnlyArray<string>` | All validation errors for the current field. (This differs from the `errors` argument in `<Field>`, since the `errors` argument in `<Field>` will be empty if `shouldShowErrors` is false) |
| valid                   | `boolean`                | Whether the field (and its children) pass their validations (NOTE: only client errors are considered!)                                                                                     |
| asyncValidationInFlight | `boolean`                | Whether there is an asynchronous validation in progress for this field                                                                                                                     |
| value                   | `T`                      | The current value for this field. (This will always match the `value` argument to `<Field>`)                                                                                               |

An example of how these data could be used:

```jsx
<Form onSubmit={handleSubmit}>
  {(link, handleSubmit, {valid}) => (
  <>
    <Field link={link}>
      {(value, errors, onChange, onBlur, {changed}) => (
        <label>
          Name
          <input
            type="text"
            value={value}
            onChange={onChange}
            onBlur={onBlur}
          />
          {changed ? "(Modified)" : null}
        </label>
      )}
    </Field>
    <button disabled={!valid} onClick={() => handleSubmit()}>
      Submit
    </button>
  </>
  )}
</Form>
```

### Multiple submission buttons

Sometimes, you need to have multiple submission buttons and need to know which button was clicked in your `onSubmit` prop callback. This can be achieved by passing additional information as an argument to the `handleSubmit` argument to your `<Form>`'s render prop. This argument will be passed to your `onSubmit` prop callback as a second argument. If your `onSubmit` prop callback is typed to make this extra data mandatory, the inner `handleSubmit` callback will require that data.

Example:

```jsx
function handleSubmit(value: User, saveOrSubmit: "save" | "submit") {
  if (saveOrSubmit === "save") {
    // ...
  } else if (saveOrSubmit === "submit") {
    // ...
  }
}

<Form onSubmit={handleSubmit}>
  {(link, handleSubmit) => (
  <>
    <UserField link={link} />
    <div>
      <button onClick={() => handleSubmit("save")}>Save</button>
      <button onClick={() => handleSubmit("submit")}>Submit</button>
    </div>
  </>
  )}
</Form>;
```

### Submitting forms externally

It is easy to submit a **formula-one** form using the `handleSubmit` argument provided to `<Form>`'s render prop, but sometimes you need to submit a `<Form>` from outside. This is possible using the `submit()` method available on `<Form>` along with a React ref to that `<Form>` element. This `submit()` method can also receive additional user-specified information, as stated above.

```jsx
function handleSubmit(value) { /* ... */ }

class MyExternalButtonExample extends React.Component<Props> {
  form: null | React.Element<typeof Form>;

  constructor(props: Props) {
    super(props);

    this.form = null;
    this.handleSubmitClick = this.handleSubmitClick.bind(this);
  }

  handleSubmitClick() {
    if (this.form != null) {
      this.form.submit();
    }
  }

  render() {
    <div>
      <Form
        ref={f => {
          this.form = f;
        }}
        onSubmit={handleSubmit}
      >
        {link => (<UserField link={link} />)}
      </Form>
      <button onClick={this.handleSubmitClick}>Submit</button>
    </div>;
  }
}
```

<!-- #### Nested forms -->

<!-- #### Disjoint union -->
