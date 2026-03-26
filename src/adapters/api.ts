import { ParseError } from "../parse/parser.js";

export interface N8nApiOptions {
  baseUrl: string;    // e.g. "https://my-n8n.example.com"
  apiKey: string;     // n8n API key
  workflowId: string; // numeric or UUID workflow id
}

/**
 * Fetch a raw n8n workflow JSON from the n8n REST API.
 * Returns the raw JS object — does NOT produce a WorkflowIR.
 * Call parse() on the result.
 *
 * n8n API endpoint: GET /api/v1/workflows/:id
 * Docs: https://docs.n8n.io/api/api-reference/
 */
export async function loadFromApi(opts: N8nApiOptions): Promise<unknown> {
  const { baseUrl, apiKey, workflowId } = opts;

  // Normalize base URL — strip trailing slash
  const base = baseUrl.replace(/\/$/, "");
  const url = `${base}/api/v1/workflows/${encodeURIComponent(workflowId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "X-N8N-API-KEY": apiKey,
        "Accept": "application/json",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseError(`Network error fetching workflow from n8n API: ${msg}`);
  }

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      // ignore read error
    }
    throw new ParseError(
      `n8n API returned HTTP ${response.status} for workflow "${workflowId}". Body: ${body.slice(0, 200)}`
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseError(`n8n API response is not valid JSON: ${msg}`);
  }

  // n8n API wraps the workflow in a top-level object in some versions.
  // If we see { data: { nodes: [...] } }, unwrap it.
  if (
    typeof json === "object" &&
    json !== null &&
    "data" in json &&
    typeof (json as Record<string, unknown>).data === "object"
  ) {
    return (json as Record<string, unknown>).data;
  }

  return json;
}
