// @flow strict

export type TracerDelegate = {
  // componentDidUpdate on Form keeps dirty updated
  dirty: boolean,
};

class Tracer {
  delegates: Array<TracerDelegate> = [];

  register(): TracerDelegate {
    const delegate: TracerDelegate = {dirty: false};
    this.delegates.push(delegate);
    return delegate;
  }

  unregister(delegate: TracerDelegate): void {
    const idx: number = this.delegates.indexOf(delegate);
    if (idx > -1) {
      this.delegates.splice(idx, 1);
    }
  }

  isDirty(): boolean {
    return this.delegates.some(d => d.dirty);
  }
}

// Share a global instance
export default new Tracer();
