import { useEffect, useMemo, useRef, useState } from "react";
import BorderSelector from "./BorderSelector";
import WeightMenu from "./menus/WeightMenu";
import StyleMenu from "./menus/StyleMenu";
import { BorderStyle, BorderValueMap, BorderWeight, SelectedEdges } from "./logic/types";
import { computeInitialSelection } from "./logic/selectionInit";
import { normalizeEdgeChange } from "./logic/normalize";
import {
  MixedOr,
  computeMixedStyle,
  computeMixedWeight,
  interdependencyDisabled,
} from "./logic/mixedState";

function BorderControl(props: {
  valueMap: BorderValueMap;
  showInner?: boolean;
  onChange: (next: BorderValueMap) => void;
  initialSelected?: SelectedEdges;
  /** Identifies the thing being edited (a cell or a table). When it changes,
   *  the edge selection is recomputed for the new object instead of carrying
   *  the previous one over. Callers pass elementKey(cell | table). */
  identity?: string;
}) {
  const showInner = props.showInner ?? true;
  // Maintain a local copy so the UI reflects changes immediately
  const [valueMap, setValueMap] = useState<BorderValueMap>(props.valueMap);
  const [selected, setSelected] = useState<SelectedEdges>(
    () => props.initialSelected ?? computeInitialSelection(props.valueMap, showInner),
  );
  const identityRef = useRef(props.identity);

  // Sync local state when the upstream map changes (e.g., switching cells/tables).
  // The edge selection describes one object's border pattern, so it has to be
  // recomputed whenever we start editing a different cell or table; keeping the
  // old selection would send the next Style/Weight click to edges the user never
  // chose for this object.
  useEffect(() => {
    setValueMap(props.valueMap);
    if (identityRef.current !== props.identity) {
      identityRef.current = props.identity;
      setSelected(props.initialSelected ?? computeInitialSelection(props.valueMap, showInner));
    }
  }, [props.valueMap, props.identity]);

  const weight: MixedOr<BorderWeight> = useMemo(
    () => computeMixedWeight(valueMap, selected),
    [valueMap, selected],
  );
  const style: MixedOr<BorderStyle> = useMemo(
    () => computeMixedStyle(valueMap, selected),
    [valueMap, selected],
  );

  const disabled = interdependencyDisabled(weight, style);
  // Force the selector to use the 'rounded' look and remove the Look menu
  const selectorLook: "rounded" = "rounded";

  const apply = (
    change: Partial<{
      weight: BorderWeight;
      style: BorderStyle;
    }>,
  ) => {
    const edges = Array.from(selected);
    if (edges.length === 0) return; // nothing to apply
    const next: BorderValueMap = { ...valueMap } as BorderValueMap;
    for (const e of edges) {
      // Normalize with the same rules the toolbar's border commands use, so
      // picking a style on an invisible edge makes it visible (weight 1) rather
      // than storing a style nothing can draw.
      const { weight, style } = normalizeEdgeChange(next[e], change);
      next[e] = { ...next[e], weight: weight as BorderWeight, style };
    }
    setValueMap(next);
    props.onChange(next);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <BorderSelector
          valueMap={valueMap}
          showInner={showInner}
          selected={selected}
          onChange={setSelected}
          size={80}
          look={selectorLook}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <StyleMenu
            value={style as any}
            onChange={(v) => apply({ style: v })}
            disabled={disabled.styleDisabled}
          />
          <WeightMenu
            value={weight as any}
            currentStyle={style as any}
            onChange={(v) => apply({ weight: v })}
            disabled={disabled.weightDisabled}
          />
        </div>
      </div>
    </div>
  );
}

export { BorderControl };
