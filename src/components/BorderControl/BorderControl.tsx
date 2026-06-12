import { useEffect, useMemo, useState } from "react";
import BorderSelector from "./BorderSelector";
import WeightMenu from "./menus/WeightMenu";
import StyleMenu from "./menus/StyleMenu";
import { BorderStyle, BorderValueMap, BorderWeight, SelectedEdges } from "./logic/types";
import { computeInitialSelection } from "./logic/selectionInit";
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
}) {
  const showInner = props.showInner ?? true;
  // Maintain a local copy so the UI reflects changes immediately
  const [valueMap, setValueMap] = useState<BorderValueMap>(props.valueMap);
  const [selected, setSelected] = useState<SelectedEdges>(
    () => props.initialSelected ?? computeInitialSelection(props.valueMap, showInner),
  );

  // Sync local state when the upstream map changes (e.g., switching cells/tables)
  useEffect(() => {
    setValueMap(props.valueMap);
  }, [props.valueMap]);

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
      next[e] = { ...next[e], ...change } as any;
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
