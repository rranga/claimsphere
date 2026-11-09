import { memo, useState, type PointerEvent } from 'react';
import type { Annotation, AnnotationKind, NormalizedRect, Rotation } from '@/shared/api/contracts';
import { cn } from '@/shared/lib/cn';
import { rectFromPoints, rectToPage, rectToView, type Point } from '../lib/geometry';
import type { WorkspaceTool } from '../model/workspaceSlice';

interface Props {
  pageId: string;
  rotation: Rotation;
  annotations: readonly Annotation[] | undefined;
  tool: WorkspaceTool;
  canAnnotate: boolean;
  onCreate: (pageId: string, kind: AnnotationKind, rect: NormalizedRect) => void;
}

const STYLE: Record<AnnotationKind, string> = {
  highlight: 'fill-yellow-300/45 stroke-yellow-500/60',
  rectangle: 'fill-transparent stroke-danger-500',
};

/**
 * SVG overlay in a 0–1 viewBox stretched over the page: annotations scale with zoom for free
 * and never require re-rendering the (expensive) PDF canvas.
 */
export const AnnotationLayer = memo(function AnnotationLayer({
  pageId,
  rotation,
  annotations,
  tool,
  canAnnotate,
  onCreate,
}: Props) {
  const [drag, setDrag] = useState<{ start: Point; current: Point } | null>(null);
  const drawing = canAnnotate && tool !== 'select';

  const toLocal = (event: PointerEvent<SVGSVGElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
  };

  const finish = () => {
    if (drag && tool !== 'select') {
      const viewRect = rectFromPoints(drag.start, drag.current);
      if (viewRect.width > 0.01 && viewRect.height > 0.005)
        onCreate(pageId, tool, rectToPage(viewRect, rotation));
    }
    setDrag(null);
  };

  const draft = drag ? rectFromPoints(drag.start, drag.current) : null;

  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className={cn(
        'absolute inset-0 size-full touch-none',
        drawing ? 'cursor-crosshair' : 'pointer-events-none',
      )}
      aria-hidden="true"
      onPointerDown={(event) => {
        if (!drawing) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = toLocal(event);
        setDrag({ start: point, current: point });
      }}
      onPointerMove={(event) => drag && setDrag({ ...drag, current: toLocal(event) })}
      onPointerUp={finish}
      onPointerCancel={() => setDrag(null)}
    >
      {annotations?.map((annotation) => {
        const r = rectToView(annotation.rect, rotation);
        return (
          <rect
            key={annotation.id}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            className={cn(STYLE[annotation.kind], annotation.id.startsWith('temp-') && 'opacity-60')}
          />
        );
      })}
      {draft && tool !== 'select' && (
        <rect
          x={draft.x}
          y={draft.y}
          width={draft.width}
          height={draft.height}
          vectorEffect="non-scaling-stroke"
          strokeWidth={2}
          strokeDasharray="4 3"
          className={STYLE[tool]}
        />
      )}
    </svg>
  );
});
