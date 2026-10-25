"use client";

import { Component, type ReactNode } from "react";

// If WebGL can't start (old device, GPU blocked, lost context), keep the page working without the 3D scene.
export default class SceneErrorBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
