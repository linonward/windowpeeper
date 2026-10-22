// "Use this scene" in the home page's Scenes section dispatches it on
// window with the scene as `detail`; the generator picks that scene.
export const SCENE_EVENT = "windowpeeper:scene";

export function pickScene(scene: string) {
  window.dispatchEvent(new CustomEvent(SCENE_EVENT, { detail: scene }));
}
