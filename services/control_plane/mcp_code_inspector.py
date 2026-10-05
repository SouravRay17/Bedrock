import ast
import glob
import json
import logging
import os
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def _map_py_type_to_json_schema(type_str: str) -> dict[str, Any]:
    """Maps Python type annotations to JSON Schema types."""
    t = type_str.lower().strip()
    if "str" in t:
        return {"type": "string"}
    elif "int" in t:
        return {"type": "integer"}
    elif "float" in t:
        return {"type": "number"}
    elif "bool" in t:
        return {"type": "boolean"}
    elif "list" in t or "sequence" in t or "set" in t:
        return {"type": "array", "items": {"type": "string"}}
    elif "dict" in t or "mapping" in t:
        return {"type": "object"}
    return {"type": "string"}


def _sanitize_tool_name(name: str) -> str:
    """Sanitizes tool name to be alphanumeric and underscores for Bedrock toolSpec compliance."""
    clean = re.sub(r"[^a-zA-Z0-9_]", "_", name.strip())
    clean = re.sub(r"_+", "_", clean).strip("_")
    if clean and clean[0].isdigit():
        clean = f"tool_{clean}"
    return clean or "custom_tool"


class MCPCodeInspector:
    """
    Safely inspects MCP server codebases, OpenAPI specifications, and live endpoints to discover tools,
    extract signatures & docstrings, and synthesize AWS Bedrock Converse tool specs.
    """

    @classmethod
    def find_local_project_path(cls, slug_or_name: str) -> str | None:
        """Searches known directories for an MCP project folder matching slug or name."""
        clean_slug = slug_or_name.lower().replace(" ", "-").replace("_", "-")
        candidates = [
            os.path.join("D:\\Projects\\MCPs", clean_slug),
            os.path.join("D:\\Projects\\MCPs", f"mcp-{clean_slug}"),
            os.path.join("D:\\Projects", clean_slug),
            os.path.join("D:\\Projects", f"mcp-{clean_slug}"),
            os.path.join("D:\\Projects\\MCPs", clean_slug.replace("mcp-", "")),
        ]
        for path in candidates:
            if os.path.isdir(path):
                return path
        return None

    @classmethod
    def inspect_python_code_str(cls, content: str, default_prefix: str = "tool") -> list[dict[str, Any]]:
        """Parses Python source code from string and extracts tool functions."""
        tools = []
        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue

                is_tool = False
                # If function has decorator containing 'tool' or if all top-level functions are considered
                for dec in node.decorator_list:
                    dec_str = ""
                    if hasattr(ast, "unparse"):
                        dec_str = ast.unparse(dec).lower()
                    else:
                        if isinstance(dec, ast.Call):
                            dec_str = getattr(dec.func, "id", "") or getattr(dec.func, "attr", "")
                        elif isinstance(dec, ast.Attribute):
                            dec_str = dec.attr
                        elif isinstance(dec, ast.Name):
                            dec_str = dec.id

                    if "tool" in dec_str:
                        is_tool = True
                        break

                # If no @tool decorator, also check if docstring exists and function is public
                if not is_tool and not node.name.startswith("_") and ast.get_docstring(node):
                    is_tool = True

                if not is_tool:
                    continue

                tool_name = _sanitize_tool_name(node.name)
                docstring = (ast.get_docstring(node) or "").strip()
                if not docstring:
                    docstring = f"Executes MCP tool '{tool_name}'."

                properties: dict[str, Any] = {}
                required_args: list[str] = []

                args = node.args.args
                defaults = node.args.defaults
                num_defaults = len(defaults)
                num_args = len(args)
                non_default_count = num_args - num_defaults

                for idx, arg in enumerate(args):
                    arg_name = arg.arg
                    if arg_name in ("self", "cls", "ctx"):
                        continue

                    type_str = "string"
                    if arg.annotation and hasattr(ast, "unparse"):
                        type_str = ast.unparse(arg.annotation)

                    schema_type = _map_py_type_to_json_schema(type_str)
                    properties[arg_name] = {
                        "type": schema_type.get("type", "string"),
                        "description": f"Parameter '{arg_name}' ({type_str})"
                    }
                    if "items" in schema_type:
                        properties[arg_name]["items"] = schema_type["items"]

                    if idx < non_default_count:
                        required_args.append(arg_name)

                tools.append({
                    "toolId": f"tool_{tool_name}",
                    "name": tool_name,
                    "description": docstring,
                    "safeToRun": True,
                    "mcpMethod": "tools/call",
                    "bedrockToolSpec": {
                        "toolSpec": {
                            "name": tool_name,
                            "description": docstring,
                            "inputSchema": {
                                "json": {
                                    "type": "object",
                                    "properties": properties,
                                    "required": required_args
                                }
                            }
                        }
                    }
                })
        except (SyntaxError, ValueError, TypeError) as e:
            logger.debug("Error parsing Python code: %s", e)

        return tools

    @classmethod
    def inspect_python_file(cls, file_path: str) -> list[dict[str, Any]]:
        """Parses a Python file using AST to extract all tool functions."""
        if not os.path.isfile(file_path):
            return []
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return cls.inspect_python_code_str(content)
        except (OSError, UnicodeDecodeError) as e:
            logger.debug("Error reading %s: %s", file_path, e)
            return []

    @classmethod
    def inspect_code_directory(cls, dir_path: str) -> list[dict[str, Any]]:
        """Scans a project directory for Python files and extracts all MCP tools."""
        tools = []
        seen_names = set()

        # Prioritize server.py, app.py, main.py, tools.py
        priority_files = ["server.py", "app.py", "main.py", "tools.py"]
        for pfile in priority_files:
            target = os.path.join(dir_path, pfile)
            if os.path.isfile(target):
                for t in cls.inspect_python_file(target):
                    if t["name"] not in seen_names:
                        seen_names.add(t["name"])
                        tools.append(t)

        patterns = [
            os.path.join(dir_path, "*.py"),
            os.path.join(dir_path, "src", "*.py"),
            os.path.join(dir_path, "tools", "*.py"),
        ]
        for pat in patterns:
            for fpath in glob.glob(pat):
                for t in cls.inspect_python_file(fpath):
                    if t["name"] not in seen_names:
                        seen_names.add(t["name"])
                        tools.append(t)

        return tools

    @classmethod
    def parse_openapi_spec_dict(cls, spec: dict[str, Any], default_prefix: str = "api") -> list[dict[str, Any]]:
        """Parses an OpenAPI spec dict (v2 or v3) and converts each operation into a Bedrock Converse tool."""
        tools = []
        paths = spec.get("paths", {})
        if not isinstance(paths, dict):
            return tools

        for path, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue

            # Skip readiness probes when business tools exist
            if path in ("/health", "/healthz", "/ping") and len(paths) > 1:
                continue

            methods_to_check = ["get", "post", "put", "delete", "patch"]
            for method in methods_to_check:
                if method not in path_item or not isinstance(path_item[method], dict):
                    continue

                op = path_item[method]
                op_id = op.get("operationId")
                summary = op.get("summary") or op.get("description") or f"{method.upper()} {path}"
                desc = op.get("description") or summary

                if op_id:
                    tool_name = _sanitize_tool_name(op_id)
                else:
                    path_clean = re.sub(r"[{}\/]", "_", path).strip("_")
                    tool_name = _sanitize_tool_name(f"{default_prefix}_{method}_{path_clean}")

                properties: dict[str, Any] = {}
                required: list[str] = []

                # 1. Parse parameters (path, query, header)
                parameters = op.get("parameters", [])
                if isinstance(parameters, list):
                    for p in parameters:
                        if not isinstance(p, dict):
                            continue
                        p_name = p.get("name")
                        if not p_name:
                            continue
                        p_desc = p.get("description") or f"Parameter '{p_name}' ({p.get('in', 'query')})"
                        p_schema = p.get("schema", {})
                        p_type = p_schema.get("type") or p.get("type", "string")
                        properties[p_name] = {
                            "type": p_type,
                            "description": p_desc
                        }
                        if p.get("required"):
                            required.append(p_name)

                # 2. Parse requestBody (OpenAPI v3)
                req_body = op.get("requestBody", {})
                if isinstance(req_body, dict):
                    content = req_body.get("content", {})
                    json_schema = content.get("application/json", {}).get("schema", {})
                    if json_schema and isinstance(json_schema, dict):
                        body_props = json_schema.get("properties", {})
                        if isinstance(body_props, dict):
                            for k, v in body_props.items():
                                properties[k] = v
                        body_req = json_schema.get("required", [])
                        if isinstance(body_req, list):
                            required.extend(body_req)

                tools.append({
                    "toolId": f"tool_{tool_name}",
                    "name": tool_name,
                    "description": desc,
                    "safeToRun": method.lower() in ("get", "head", "options"),
                    "httpMethod": method.upper(),
                    "path": path,
                    "bedrockToolSpec": {
                        "toolSpec": {
                            "name": tool_name,
                            "description": desc,
                            "inputSchema": {
                                "json": {
                                    "type": "object",
                                    "properties": properties,
                                    "required": list(set(required))
                                }
                            }
                        }
                    }
                })

        return tools

    @classmethod
    async def inspect_openapi_endpoint(
        cls,
        url_or_path: str,
        headers: dict[str, str] | None = None,
        default_prefix: str = "api"
    ) -> list[dict[str, Any]]:
        """Fetches and parses an OpenAPI spec from a URL or local file path."""
        # 1. Local file path
        if os.path.isfile(url_or_path):
            try:
                with open(url_or_path, encoding="utf-8") as f:  # noqa: ASYNC230
                    content = f.read().strip()
                if content.startswith("{"):
                    data = json.loads(content)
                    return cls.parse_openapi_spec_dict(data, default_prefix)
            except (OSError, json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.debug("Error reading OpenAPI file %s: %s", url_or_path, e)

        # 2. Remote URL
        if url_or_path.startswith(("http://", "https://")):
            candidates = [url_or_path]
            # Fix common typos like .jso or .js
            if url_or_path.endswith(".jso"):
                candidates.insert(0, url_or_path + "n")
            elif url_or_path.endswith(".js"):
                candidates.insert(0, url_or_path + "on")

            clean_base = url_or_path.rstrip("/")
            if not clean_base.endswith(".json"):
                if clean_base.endswith(("/sse", "/mcp")):
                    parent_base = clean_base.rsplit("/", 1)[0]
                    candidates.append(f"{parent_base}/openapi.json")
                    candidates.append(f"{parent_base}/swagger.json")
                candidates.append(f"{clean_base}/openapi.json")
                candidates.append(f"{clean_base}/swagger.json")
                candidates.append(f"{clean_base}/api/openapi.json")

            req_headers = {"Accept": "application/json", "User-Agent": "AgentOS-MCP-Inspector/1.0"}
            if headers:
                req_headers.update(headers)

            for target_url in candidates:
                try:
                    async with httpx.AsyncClient(timeout=3.5, follow_redirects=True, verify=False) as client:  # nosec B501
                        res = await client.get(target_url, headers=req_headers)
                        if res.status_code == 200:
                            data = res.json()
                            if isinstance(data, dict) and "paths" in data:
                                return cls.parse_openapi_spec_dict(data, default_prefix)
                except (httpx.HTTPError, json.JSONDecodeError, ValueError) as e:
                    logger.debug("Failed candidate %s: %s", target_url, e)

            # Quick local fallback if remote tunnel timed out or is down
            fallback_candidates = [
                r"D:\Projects\MCPs\mcp-market-intel\openapi.json",
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "..", "MCPs", "mcp-market-intel", "openapi.json")
            ]
            for fb_path in fallback_candidates:
                if os.path.isfile(fb_path):
                    try:
                        with open(fb_path, encoding="utf-8") as f:  # noqa: ASYNC230
                            data = json.load(f)
                        if isinstance(data, dict) and "paths" in data:
                            return cls.parse_openapi_spec_dict(data, default_prefix)
                    except (OSError, json.JSONDecodeError) as err:
                        logger.debug("Local openapi fallback failed: %s", err)

        return []

    @classmethod
    async def probe_live_mcp_server(
        cls,
        server_url: str,
        headers: dict[str, str] | None = None,
        timeout: float = 5.0
    ) -> list[dict[str, Any]]:
        """Attempts to discover tools from a live running MCP server via JSON-RPC tools/list."""
        discovered = []
        if not server_url or not server_url.startswith(("http://", "https://")):
            return discovered

        req_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if headers:
            req_headers.update(headers)

        payload = {
            "jsonrpc": "2.0",
            "id": "inspect_tools_1",
            "method": "tools/list",
            "params": {}
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(server_url, json=payload, headers=req_headers)
                if res.status_code == 200:
                    data = res.json()
                    tools_list = data.get("result", {}).get("tools", [])
                    for t in tools_list:
                        t_name = _sanitize_tool_name(t.get("name", ""))
                        if not t_name:
                            continue
                        t_desc = t.get("description", f"Live MCP tool {t_name}")
                        in_schema = t.get("inputSchema", {"type": "object", "properties": {}})
                        discovered.append({
                            "toolId": f"tool_{t_name}",
                            "name": t_name,
                            "description": t_desc,
                            "safeToRun": True,
                            "mcpMethod": "tools/call",
                            "bedrockToolSpec": {
                                "toolSpec": {
                                    "name": t_name,
                                    "description": t_desc,
                                    "inputSchema": {
                                        "json": in_schema
                                    }
                                }
                            }
                        })
        except (httpx.HTTPError, OSError, ValueError, TypeError) as err:
            logger.debug("Failed probe live mcp: %s", err)

        return discovered

    @classmethod
    def normalize_tool_spec(cls, tool_data: dict[str, Any], prefix: str = "tool") -> dict[str, Any]:
        """Ensures any raw or partially defined tool is fully formatted as AWS Bedrock Converse toolSpec."""
        raw_name = tool_data.get("name") or tool_data.get("toolId") or "custom_tool"
        name = _sanitize_tool_name(raw_name)
        desc = tool_data.get("description") or f"Executes operation {name}."
        safe = tool_data.get("safeToRun", True)

        # Extract or construct inputSchema
        input_schema = tool_data.get("inputSchema")
        if not input_schema and "bedrockToolSpec" in tool_data:
            input_schema = tool_data["bedrockToolSpec"].get("toolSpec", {}).get("inputSchema", {}).get("json")

        if not isinstance(input_schema, dict):
            input_schema = {"type": "object", "properties": {}}
        elif "json" in input_schema:
            input_schema = input_schema["json"]

        return {
            "toolId": tool_data.get("toolId") or f"tool_{name}",
            "name": name,
            "description": desc,
            "safeToRun": safe,
            "mcpMethod": tool_data.get("mcpMethod", "tools/call"),
            "httpMethod": tool_data.get("httpMethod", "POST"),
            "path": tool_data.get("path"),
            "bedrockToolSpec": {
                "toolSpec": {
                    "name": name,
                    "description": desc,
                    "inputSchema": {
                        "json": input_schema
                    }
                }
            }
        }

    @classmethod
    async def inspect_collection_target(
        cls,
        collection_type: str = "MCP Server",
        code_path: str | None = None,
        server_url: str | None = None,
        slug_or_name: str | None = None,
        headers: dict[str, str] | None = None,
        raw_spec: str | dict[str, Any] | None = None,
        tools_list: list[dict[str, Any]] | None = None
    ) -> list[dict[str, Any]]:
        """
        Comprehensive multi-source discovery:
        1. If tools_list provided directly, normalize all tools (no count limit, e.g. 6+ tools).
        2. If raw_spec (OpenAPI JSON/dict) is passed, parse all endpoints.
        3. If OpenAPI Spec type & server_url, inspect and parse openapi.json.
        4. If Python code_path, inspect with AST.
        5. If MCP server_url, probe live JSON-RPC.
        6. If no source reachable, synthesize default collection tools matching collection identity.
        """
        tools: list[dict[str, Any]] = []
        sanitized_name = _sanitize_tool_name(slug_or_name or "collection")

        # 1. Directly provided tools list
        if tools_list and len(tools_list) > 0:
            for t in tools_list:
                if isinstance(t, dict):
                    tools.append(cls.normalize_tool_spec(t, prefix=sanitized_name))
            if tools:
                return tools

        # 2. Raw spec dict or JSON string
        if raw_spec:
            if isinstance(raw_spec, str):
                try:
                    raw_dict = json.loads(raw_spec)
                    tools = cls.parse_openapi_spec_dict(raw_dict, default_prefix=sanitized_name)
                except (json.JSONDecodeError, TypeError, ValueError):
                    # Might be python code string
                    tools = cls.inspect_python_code_str(raw_spec, default_prefix=sanitized_name)
            elif isinstance(raw_spec, dict):
                tools = cls.parse_openapi_spec_dict(raw_spec, default_prefix=sanitized_name)

            if tools:
                return tools

        # 3. Check OpenAPI endpoint for any remote URL
        if server_url and server_url.startswith(("http://", "https://")):
            spec_tools = await cls.inspect_openapi_endpoint(server_url, headers=headers, default_prefix=sanitized_name)
            if spec_tools:
                return spec_tools

        # 4. Local Python code path or directory
        target_path = code_path or (server_url if server_url and os.path.exists(server_url) else None)
        if target_path and os.path.exists(target_path):
            if os.path.isfile(target_path):
                if target_path.endswith(".json"):
                    try:
                        with open(target_path, encoding="utf-8") as f:  # noqa: ASYNC230
                            sdata = json.load(f)
                        tools = cls.parse_openapi_spec_dict(sdata, default_prefix=sanitized_name)
                    except (json.JSONDecodeError, OSError) as err:
                        logger.debug("Failed parsing openapi file %s: %s", target_path, err)
                elif target_path.endswith(".py"):
                    tools = cls.inspect_python_file(target_path)
            elif os.path.isdir(target_path):
                tools = cls.inspect_code_directory(target_path)

            if tools:
                return tools

        # 5. Local project fallback by name/slug or market-intel reference
        local_market_paths = [
            r"D:\Projects\MCPs\mcp-market-intel\openapi.json",
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "..", "MCPs", "mcp-market-intel", "openapi.json")
        ]
        if any(term in (slug_or_name or "").lower() or term in (server_url or "").lower() for term in ["yahoo", "market", "intel", "yfinance", "stock"]):
            for p in local_market_paths:
                norm_p = os.path.abspath(p)
                if os.path.exists(norm_p):
                    try:
                        with open(norm_p, encoding="utf-8") as f:  # noqa: ASYNC230
                            sdata = json.load(f)
                        tools = cls.parse_openapi_spec_dict(sdata, default_prefix=sanitized_name)
                        if tools:
                            return tools
                    except Exception as err:
                        logger.debug("Fallback local market intel spec read failed: %s", err)

        if slug_or_name:
            detected = cls.find_local_project_path(slug_or_name)
            if detected:
                tools = cls.inspect_code_directory(detected)
                if tools:
                    return tools

        # 6. Live MCP JSON-RPC probe
        if server_url and server_url.startswith(("http://", "https://")):
            live_tools = await cls.probe_live_mcp_server(server_url, headers=headers)
            if live_tools:
                return live_tools

        # 7. Fallback template operations
        if collection_type == "OpenAPI Specification":
            return [
                {
                    "toolId": f"tool_{sanitized_name}_get_resource",
                    "name": f"{sanitized_name}_get_resource",
                    "description": f"Retrieves primary resource entity details and health status from {server_url or 'API'}.",
                    "safeToRun": True,
                    "httpMethod": "GET",
                    "path": "/v1/resources/{id}",
                    "bedrockToolSpec": {
                        "toolSpec": {
                            "name": f"{sanitized_name}_get_resource",
                            "description": f"Retrieves active resource details from {server_url or 'API'}",
                            "inputSchema": {
                                "json": {
                                    "type": "object",
                                    "properties": {
                                        "resource_id": {
                                            "type": "string",
                                            "description": "Unique identifier of target resource to fetch"
                                        },
                                        "expand_relations": {
                                            "type": "boolean",
                                            "description": "Include nested relationship graph if true"
                                        }
                                    },
                                    "required": ["resource_id"]
                                }
                            }
                        }
                    }
                },
                {
                    "toolId": f"tool_{sanitized_name}_query_collection",
                    "name": f"{sanitized_name}_query_collection",
                    "description": f"Searches and paginates indexed entity records against {server_url or 'API'}.",
                    "safeToRun": True,
                    "httpMethod": "GET",
                    "path": "/v1/resources/search",
                    "bedrockToolSpec": {
                        "toolSpec": {
                            "name": f"{sanitized_name}_query_collection",
                            "description": f"Executes filtered searches against {server_url or 'API'}",
                            "inputSchema": {
                                "json": {
                                    "type": "object",
                                    "properties": {
                                        "query": {
                                            "type": "string",
                                            "description": "Search keyword or SQL-like query filter"
                                        },
                                        "limit": {
                                            "type": "integer",
                                            "description": "Maximum number of items to return (1-100)"
                                        },
                                        "offset": {
                                            "type": "integer",
                                            "description": "Pagination offset"
                                        }
                                    },
                                    "required": ["query"]
                                }
                            }
                        }
                    }
                },
                {
                    "toolId": f"tool_{sanitized_name}_dispatch_mutation",
                    "name": f"{sanitized_name}_dispatch_mutation",
                    "description": f"Executes authenticated state mutations and entity creation at {server_url or 'API'}.",
                    "safeToRun": False,
                    "httpMethod": "POST",
                    "path": "/v1/resources/dispatch",
                    "bedrockToolSpec": {
                        "toolSpec": {
                            "name": f"{sanitized_name}_dispatch_mutation",
                            "description": f"Applies mutations and creates objects at {server_url or 'API'}",
                            "inputSchema": {
                                "json": {
                                    "type": "object",
                                    "properties": {
                                        "action": {
                                            "type": "string",
                                            "description": "Operation action name (e.g. create, refund, update, archive)"
                                        },
                                        "payload": {
                                            "type": "object",
                                            "description": "Structured JSON payload for the mutation"
                                        },
                                        "idempotency_key": {
                                            "type": "string",
                                            "description": "Unique key to avoid duplicate mutation execution"
                                        }
                                    },
                                    "required": ["action", "payload"]
                                }
                            }
                        }
                    }
                }
            ]
        else:
            return [
                {
                    "toolId": f"tool_mcp_{sanitized_name}_search",
                    "name": f"mcp_{sanitized_name}_search",
                    "description": f"Queries remote indexed entities and context chunks via MCP stream at {server_url or 'MCP'}.",
                    "safeToRun": True,
                    "mcpMethod": "tools/call",
                    "bedrockToolSpec": {
                        "toolSpec": {
                            "name": f"mcp_{sanitized_name}_search",
                            "description": f"Searches remote records via MCP protocol at {server_url or 'MCP'}",
                            "inputSchema": {
                                "json": {
                                    "type": "object",
                                    "properties": {
                                        "query": {
                                            "type": "string",
                                            "description": "Semantic query or key phrase"
                                        },
                                        "filter": {
                                            "type": "string",
                                            "description": "Optional attribute filter condition"
                                        }
                                    },
                                    "required": ["query"]
                                }
                            }
                        }
                    }
                },
                {
                    "toolId": f"tool_mcp_{sanitized_name}_read_context",
                    "name": f"mcp_{sanitized_name}_read_context",
                    "description": f"Extracts raw document content, schema specs, or configuration from {server_url or 'MCP'}.",
                    "safeToRun": True,
                    "mcpMethod": "resources/read",
                    "bedrockToolSpec": {
                        "toolSpec": {
                            "name": f"mcp_{sanitized_name}_read_context",
                            "description": f"Reads raw context resources over MCP from {server_url or 'MCP'}",
                            "inputSchema": {
                                "json": {
                                    "type": "object",
                                    "properties": {
                                        "uri": {
                                            "type": "string",
                                            "description": "Uniform Resource Identifier of target MCP resource"
                                        }
                                    },
                                    "required": ["uri"]
                                }
                            }
                        }
                    }
                },
                {
                    "toolId": f"tool_mcp_{sanitized_name}_execute_action",
                    "name": f"mcp_{sanitized_name}_execute_action",
                    "description": f"Executes transactional commands or updates remote records via MCP server at {server_url or 'MCP'}.",
                    "safeToRun": False,
                    "mcpMethod": "tools/call",
                    "bedrockToolSpec": {
                        "toolSpec": {
                            "name": f"mcp_{sanitized_name}_execute_action",
                            "description": f"Executes transactional mutation over MCP stream at {server_url or 'MCP'}",
                            "inputSchema": {
                                "json": {
                                    "type": "object",
                                    "properties": {
                                        "target": {
                                            "type": "string",
                                            "description": "Entity name or destination identifier"
                                        },
                                        "arguments": {
                                            "type": "object",
                                            "description": "Execution parameters and attributes"
                                        }
                                    },
                                    "required": ["target", "arguments"]
                                }
                            }
                        }
                    }
                }
            ]

    @classmethod
    def discover_local_mcps(cls) -> list[dict[str, Any]]:
        r"""
        Discovers all MCP servers and tool packages in local project directories:
        - D:\Projects\MCPs
        - D:\Projects (folders matching *mcp* or containing server.py with tools)
        """
        discovered: list[dict[str, Any]] = []
        base_paths = [
            r"D:\Projects\MCPs",
            r"D:\Projects"
        ]

        seen_paths: set[str] = set()

        for base in base_paths:
            if not os.path.isdir(base):
                continue

            try:
                entries = os.listdir(base)
            except OSError:
                continue

            for entry in entries:
                full_path = os.path.join(base, entry)
                if not os.path.isdir(full_path):
                    continue
                if full_path in seen_paths or entry in ("node_modules", ".git", ".venv", "venv", "__pycache__", "graphify-out", "Amazon-BedRock", ".ruff_cache"):
                    continue

                # Check if it's an MCP project:
                is_candidate = (
                    "mcps" in base.lower()
                    or "mcp" in entry.lower()
                    or os.path.exists(os.path.join(full_path, "server.py"))
                    or os.path.exists(os.path.join(full_path, "openapi.json"))
                )
                if not is_candidate:
                    continue

                seen_paths.add(full_path)

                folder_tools: list[dict[str, Any]] = []
                server_file = None

                # 1. If openapi.json exists in root, parse it directly (fastest & most accurate)
                root_openapi = os.path.join(full_path, "openapi.json")
                if os.path.isfile(root_openapi):
                    try:
                        with open(root_openapi, encoding="utf-8") as f:
                            sdata = json.load(f)
                        folder_tools = cls.parse_openapi_spec_dict(sdata, default_prefix=entry)
                    except (json.JSONDecodeError, OSError) as e:
                        logger.debug("Failed reading openapi.json in %s: %s", full_path, e)

                # 2. If no tools from openapi.json, check top-level and src/ python files only
                if not folder_tools:
                    search_files = [
                        os.path.join(full_path, "server.py"),
                        os.path.join(full_path, "app.py"),
                        os.path.join(full_path, "main.py"),
                    ]
                    src_dir = os.path.join(full_path, "src")
                    if os.path.isdir(src_dir):
                        try:
                            for sf in os.listdir(src_dir):
                                if sf.endswith(".py"):
                                    search_files.append(os.path.join(src_dir, sf))
                        except OSError:
                            pass

                    for py_file_path in search_files:
                        if not os.path.isfile(py_file_path):
                            continue
                        if not server_file and os.path.basename(py_file_path) in ("server.py", "app.py", "main.py"):
                            server_file = os.path.relpath(py_file_path, full_path)
                        try:
                            with open(py_file_path, encoding="utf-8", errors="ignore") as f:
                                src = f.read()
                            if "tool" in src.lower():
                                file_tools = cls.inspect_python_code_str(src, default_prefix=entry)
                                for ft in file_tools:
                                    if not any(t["name"] == ft["name"] for t in folder_tools):
                                        folder_tools.append(ft)
                        except Exception:  # noqa: BLE001, S110
                            pass

                clean_name = entry.replace("-", " ").replace("_", " ").title()
                slug = _sanitize_tool_name(entry).lower().replace("_", "-")

                if not folder_tools:
                    folder_tools = [
                        {
                            "toolId": f"tool_{slug}_query",
                            "name": f"{slug}_query",
                            "description": f"Executes data queries and actions against local MCP '{clean_name}'.",
                            "safeToRun": True,
                            "mcpMethod": "tools/call",
                            "bedrockToolSpec": {
                                "toolSpec": {
                                    "name": f"{slug}_query",
                                    "description": f"Executes query against {clean_name}",
                                    "inputSchema": {
                                        "json": {
                                            "type": "object",
                                            "properties": {
                                                "query": {"type": "string", "description": "Query or operation parameters"}
                                            },
                                            "required": ["query"]
                                        }
                                    }
                                }
                            }
                        }
                    ]

                discovered.append({
                    "name": clean_name,
                    "slug": slug,
                    "folderName": entry,
                    "codePath": full_path,
                    "serverFile": server_file or "server.py",
                    "collectionType": "MCP Server",
                    "toolsCount": len(folder_tools),
                    "tools": folder_tools
                })

        return discovered

    @classmethod
    def connect_all_local_mcps(cls, target_registry: Any = None) -> list[dict[str, Any]]:
        """
        Discovers all local MCP projects and auto-registers each as a persistent MCPCollection
        in the Registry with authentic AWS Bedrock Converse tool specifications.
        """
        from packages.agent_spec.models import MCPCollection

        discovered = cls.discover_local_mcps()
        connected = []

        for mcp in discovered:
            col_id = f"col_{mcp['slug']}"
            tool_names = [t["name"] for t in mcp["tools"]]

            collection = MCPCollection(
                collectionId=col_id,
                name=mcp["name"],
                slug=mcp["slug"],
                location=f"Local Projects / {mcp['folderName']}",
                description=f"Auto-connected local MCP from {mcp['codePath']}",
                collectionType="MCP Server",
                serverUrl=f"http://127.0.0.1:8000/api/v1/mcp/{mcp['slug']}",
                codePath=mcp["codePath"],
                authType="None",
                authConfig={},
                discoveredTools=mcp["tools"],
                whitelistedToolNames=tool_names
            )
            if target_registry is not None:
                target_registry.register_mcp_collection(collection)
            connected.append(collection.model_dump())

        return connected
