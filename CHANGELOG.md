# Changelog

### v0.9.3

#### Bug fixes

- Fix a bug which caused validations to receive incorrect data when `Field` elements were reused with different links.
- Fix a bug which caused `customChange` to not be called when the array mutators (`addField`, `addFields`, `removeField`, `filterFields`, `modifyFields`, and `moveField`) were used.

#### New features

- Add `Blurred`, a new `FeedbackStrategy` which shows errors after a field has been blurred.
- Add `blurred: boolean` to the extra info passed to `Field` and `Form` render functions.
- Add a third parameter to `<Form>`'s `onSubmit` prop. The new API is:

  ```js
  // ExtraSubmitData is the type of the argument of `onSubmit` in your form.
  type SubmitTips = {valid: {client: boolean, external: boolean}};

  onSubmit: (T, ExtraSubmitData, SubmitTips) => void,
  ```

  This new parameter makes it easier to handle form submissions when the form validations are failing.

#### Other

- Bump internal Flow version to 0.106.3.

### v0.9.2

- Add TypeScript type definitions! 🎉

### v0.9.1

#### Breaking changes

- Rename `serverErrors` to `externalErrors`. Validation errors from outside Formula One aren't necessarily from a server. This prop is also no longer a required parameter to `Form`, so only set it if you need it.
- Bump internal flow version to 0.95.1.
- The React peer dependency was advanced to 16.8.0, since formula-one now uses hooks in its components. This also gets us ready for a hooks-based API!

#### New features

- Add `customChange` prop to `ObjectField` and `ArrayField`. This allows changes in one part of the object to affect other parts of the form. Currently, no metadata is preserved (all fields are marked **changed**, **touched**, and **succeeded** loses history) if a `customChange` function is used. This will be addressed in a future API.

  The API is:

  ```js
  // Override nextValue by returning a non-null result
  customChange: <T>(prevValue: T, nextValue: T) => null | T;
  ```

- Add `addFields`, `filterFields`, and `modifyFields` array manipulators. These are currently necessary due to the non-atomic nature of the current `addField` and `removeField` manipulators. They will be made atomic in a future version.

  The API is:

  ```jsx
  // A type indicating a range to be inserted at an index
  type Span<E> = [number, $ReadOnlyArray<E>];

  // A way to atomicly add fields to an ArrayField<E>
  addFields: (spans: $ReadOnlyArray<Span<E>) => void;

  // A way to remove fields from an ArrayField<E>
  filterFields: (predicate: (item: E, index: number) => boolean) => void

  // A way to simultaneously add and remove fields from an ArrayField<E>
  modifyFields: ({
    insertSpans: $ReadOnlyArray<Span<E>,
    filterPredicate: (item: E, index: number) => boolean
  }) => void
  ```

- `Form`'s `feedbackStrategy` prop now defaults to `Always`, which is convenient while building a form, though you'll likely want to pick another option for better UX in production.

#### Minor changes

- Add TypeScript types.
- Fix flow types for `ErrorsHelper`.

### v0.9.0

- Fumbled release. Has everything from 0.9.1 but also a bad peer dependency.
  Use 0.9.1 instead.

### v0.8.2

- Fix incorrect export caused by OS X case insensitivity

### v0.8.1

- Fix bad path in /dist caused by OS X case insensitivity

### v0.8.0

- Add `onValidation` prop to `Form`. This is a callback which will be called any time validations occur within the form. It receives a boolean, which is whether the form is valid according to the formula-one validations.

### v0.7.0

- Fix the types of the links produced by all `Field`s. This breakage occurred because `React.ElementConfig` is broken for components with a type parameter.
- Add type tests to ensure the types stay working.

### v0.6.4

- Update Flow types to work with Flow 0.86.0.

### v0.6.3

- Fix another feedbackStrategy import issue. Also, yarn ignores .npmignore files when packing for publish, so that's broken too: https://github.com/yarnpkg/yarn/issues/685

### v0.6.2

- Remove tests from the npm package. This will prevent flow from trying to check the test files and also makes the package smaller.

### v0.6.1

- Export FeedbackStrategies under the right name.

### v0.6.0

- Rework the `feedbackStrategy` prop. Several primitive strategies and algebraic combinators are exported under `FeedbackStrategies`, a new top-level export. See the documentation for more info.

### v0.5.0

- Expose a `submit(extraData)` method on `<Form>` to submit forms from a ref.

### v0.4.0

- Implement all of the feedback strategies.

### v0.3.1

- Unbreak a test.

### v0.3.0

- Add a way to pass additional information to `onSubmit` as a second argument.
- Add `onChange` prop to `<Form>`. Make `onChange` and `onSubmit` optional, since they probably won't co-occur.
- Add additional information to render functions for `<Form>` and `Field`s as a third argument.

### v0.2.1

- Reworked how external errors are updated. Fixes a bug where an exception would be thrown if the tree shapes didn't match. This could happen if you have a field which creates an object or array, which are not translated to leaf nodes internally.
- Added CHANGELOG
