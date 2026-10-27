// Phones have very dense screens but much weaker GPUs, so they render a little below
// native sharpness. The difference is hard to see; the frame rate difference is not.
export function initialPixelRatio() {
  const isPhone = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 768;
  return Math.min(window.devicePixelRatio || 1, isPhone ? 1.25 : 1.5);
}

// How far an animation timeline should advance this frame. Frames advance by real time, so even
// a 10-30 fps phone plays the animation at its intended speed. A one-off stall (shader compile,
// garbage collection, a backgrounded tab) is capped at a tenth of a second, so the animation
// never visibly jumps ahead.
export function timelineStep(delta: number) {
  return Math.min(delta, 0.1);
}
