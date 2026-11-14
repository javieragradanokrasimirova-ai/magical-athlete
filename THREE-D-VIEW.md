# Interactive 3D tabletop

The default Board lazily loads Board3D on the client. Board2D retains the original SVG presentation and coordinate calibration. The same public Game and playback frames drive both views, so camera changes never enter room actions or the deterministic rules engine.

- React Three Fiber 9 / React 19, Three.js and Drei.
- Original English board artwork composed into a local CanvasTexture with sRGB color annotation. No external scene assets or model service.
- Upright illustrated double-sided pieces, colored bases, active ring, falling and movement/warp transitions. Per-frame work uses refs, delta timing and demand rendering.
- Orbit with mouse/touch, zoom, rotation buttons, top view and reset. Camera belongs to the current mounted browser view; polling does not reset it.
- Flat view remains available. Error boundary and context-loss handling provide a playable fallback. Lineup and decision buttons remain keyboard accessible in the DOM.
- DPR capped at 1.5, single 1024 shadow map, reduced-motion support, texture disposal on scene removal.

Validation: TypeScript; existing 150-match rules/presentation checks; local two-player room API checks; browser run through a complete Mild race and transition to Wild; move playback; orbit/zoom/reset/top controls; flat/3D switching; desktop and 390px viewport. No console errors observed. Touch gestures use OrbitControls defaults; physical-device touch testing was not available.
