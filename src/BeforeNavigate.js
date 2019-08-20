// @flow strict

import Delegate from "./Delegate";

class BeforeNavigate {
  delegates: Array<Delegate> = [];

  register(delegate: Delegate): void {
    this.delegates.push(delegate);
  }

  unregister(delegate: Delegate): void {
    const idx: number = this.delegates.indexOf(delegate);
    if (idx > -1) {
      this.delegates.splice(idx, 1);
    }
  }

  shouldConfirm(newUrl: string | null): boolean {
    return this.delegates.some(d => d.shouldConfirm(newUrl));
  }
}

// Share a global instance
export default new BeforeNavigate();
