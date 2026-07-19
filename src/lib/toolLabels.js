const TOOL_LABELS = {
  hybrid_search_papers: "Reading your library...",
  search_papers: "Searching arXiv...",
  extract_info: "Pulling paper details...",
  check_semantic_cache: "Checking previous answers...",
};

export function friendlyToolLabel(toolName) {
  return TOOL_LABELS[toolName] || "Working...";
}