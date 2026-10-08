export function canRunInitialDrawing({ drawing, drawingError, eventStatus }) {
  return !drawingError && !drawing && eventStatus === "CLOSED";
}
