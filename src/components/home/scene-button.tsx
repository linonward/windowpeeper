"use client";

import { pickScene } from "./scene-event";

// "Use this scene": picks the scene in the generator and scrolls up to it.
export function SceneButton({
  scene,
  className,
  children,
  ...props
}: { scene: string; className?: string; children: React.ReactNode } & React.ComponentProps<"a">) {
  return (
    // An anchor, so it still scrolls without JavaScript.
    <a href="#generator" onClick={() => pickScene(scene)} className={className} {...props}>
      {children}
    </a>
  );
}
