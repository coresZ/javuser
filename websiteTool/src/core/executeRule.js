function executeDataRule(rule) {
  const action = rule ? getAction(rule.action) : null;
  if (!action || action.kind !== "data" || typeof action.run !== "function") {
    return { ok: false, count: 0, message: "该规则不是可执行的数据动作" };
  }
  const fields = action.needs && action.needs.length ? action.needs : extractFieldsFor(rule.targetType);
  let nodes = [];
  try {
    nodes = document.querySelectorAll(rule.selector);
  } catch {
    nodes = [];
  }
  const items = [];
  for (const node of nodes) {
    const item = extractElement(node, rule.targetType, fields);
    if (Object.keys(item).length > 1) items.push(item);
  }
  if (!items.length) {
    return { ok: false, count: 0, message: "未匹配到元素" };
  }
  try {
    const result = action.run(items);
    return {
      ok: true,
      count: items.length,
      message: typeof result === "string" && result ? result : "已执行 " + items.length + " 项"
    };
  } catch (err) {
    console.error("[Execute]", err);
    return { ok: false, count: 0, message: "执行失败: " + (err && err.message ? err.message : err) };
  }
}
