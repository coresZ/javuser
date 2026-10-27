var RuleEngine = class {
  applyRules(hostname) {
    if (!rulesManager.isSiteEnabled(hostname)) return;
    const rules = rulesManager.getRules(hostname);
    for (const rule of rules) {
      if (rule.enabled === false) continue;
      this.applyRule(rule);
    }
  }
  /** 回滚某站点所有 apply 类规则（站点整体关闭时调用） */
  unapplyRules(hostname) {
    const rules = rulesManager.getRules(hostname);
    for (const rule of rules) {
      if (rule.enabled === false) continue;
      this.unapplyRule(rule);
    }
  }
  applyRule(rule) {
    const action = getAction(rule.action);
    if (!action || action.kind !== "apply") return;
    let nodes = [];
    try {
      nodes = document.querySelectorAll(rule.selector);
    } catch {
      return;
    }
    for (const node of nodes) {
      try {
        action.apply(node, { rule });
      } catch (err) {
        console.error("[RuleEngine] apply error", err);
      }
    }
  }
  unapplyRule(rule) {
    const action = getAction(rule.action);
    if (!action || action.kind !== "apply" || typeof action.undo !== "function") return;
    let nodes = [];
    try {
      nodes = document.querySelectorAll(rule.selector);
    } catch {
      return;
    }
    for (const node of nodes) {
      try {
        action.undo(node, { rule });
      } catch (err) {
        console.error("[RuleEngine] undo error", err);
      }
    }
  }
};
var ruleEngine = new RuleEngine();
