START_NODE_KEY = "start"


class GraphValidationError(Exception):
    def __init__(self, issues: list[dict]):
        self.issues = issues
        messages = [i["message"] for i in issues if i["type"] == "error"]
        super().__init__("; ".join(messages))


def validate_scenario_graph(nodes, transitions) -> list[dict]:
    """Validate scenario graph for publishing. Returns list of issues."""
    issues: list[dict] = []
    node_list = list(nodes)
    transition_list = list(transitions)

    start_nodes = [n for n in node_list if n.key == START_NODE_KEY]
    if len(start_nodes) != 1:
        issues.append({
            "type": "error",
            "message": "Должен быть ровно один узел start",
        })
        return issues

    start_node = start_nodes[0]
    reachable = _find_reachable(start_node.id, transition_list)

    for node in node_list:
        if node.id not in reachable:
            issues.append({
                "type": "error",
                "message": f"Узел «{node.key}» недостижим из start",
                "node_id": node.id,
            })

    for node in node_list:
        if node.type == "menu":
            buttons = node.config.get("buttons", [])
            outgoing = [t for t in transition_list if t.from_node_id == node.id]
            for btn in buttons:
                if not any(
                    t.trigger == "callback" and t.trigger_value == btn["callback"]
                    for t in outgoing
                ):
                    issues.append({
                        "type": "error",
                        "message": f"Кнопка «{btn['text']}» в «{node.key}» не имеет перехода",
                        "node_id": node.id,
                    })

        if node.type == "condition":
            outgoing = [t for t in transition_list if t.from_node_id == node.id]
            always_transitions = [t for t in outgoing if t.trigger == "always"]
            if not always_transitions:
                issues.append({
                    "type": "error",
                    "message": f"Узел «{node.key}» не имеет fallback-перехода (trigger=always)",
                    "node_id": node.id,
                })

    cycle_warnings = _detect_cycles_without_exit(node_list, transition_list)
    issues.extend(cycle_warnings)

    return issues


def _find_reachable(start_id: int, transitions) -> set[int]:
    reachable: set[int] = set()
    queue = [start_id]
    while queue:
        current = queue.pop(0)
        if current in reachable:
            continue
        reachable.add(current)
        for t in transitions:
            if t.from_node_id == current and t.to_node_id not in reachable:
                queue.append(t.to_node_id)
    return reachable


def _detect_cycles_without_exit(nodes, transitions) -> list[dict]:
    """Non-blocking warning for cycles lacking condition/question exits."""
    warnings: list[dict] = []
    node_by_id = {n.id: n for n in nodes}
    adj: dict[int, list[int]] = {}
    for t in transitions:
        adj.setdefault(t.from_node_id, []).append(t.to_node_id)

    visited: set[int] = set()
    stack: set[int] = set()

    def dfs(node_id: int, path: list[int]) -> None:
        visited.add(node_id)
        stack.add(node_id)
        for nxt in adj.get(node_id, []):
            if nxt in stack:
                cycle_nodes = [node_by_id[nid].key for nid in path[path.index(nxt):] + [nxt]]
                if all(node_by_id[nid].type in ("message", "action", "delay") for nid in path):
                    warnings.append({
                        "type": "warning",
                        "message": f"Обнаружен цикл без выходных условий: {' -> '.join(cycle_nodes)}",
                    })
            elif nxt not in visited:
                dfs(nxt, path + [nxt])
        stack.remove(node_id)

    for node in nodes:
        if node.id not in visited:
            dfs(node.id, [node.id])

    return warnings
