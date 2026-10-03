"""Replays a suite dump from scripts/suite.mjs through the official Python package (cactus-needle),
binding the exact tools the wasm run bound, and reports where the two engines' calls differ.

    node scripts/suite.mjs --dump /tmp/acme.json
    .venv/bin/python scripts/reference.py /tmp/acme.json
"""

import json
import sys

import needle


def canonical(calls: list[dict] | None) -> str:
    return json.dumps(sorted(calls or [], key=lambda c: c["name"]), sort_keys=True)


def main(path: str) -> None:
    with open(path) as f:
        dump = json.load(f)

    same = 0
    for case in dump["cases"]:
        with needle.Needle(tools=case["tools"], system=dump["system"], auto_date=False) as agent:
            ref = agent.complete(case["request"])
        wasm = case["response"]
        equal = canonical(ref.get("function_calls")) == canonical(wasm.get("function_calls"))
        same += equal
        if not equal:
            print(
                f"DIFF {case['request']!r}\n"
                f"  wasm: {json.dumps(wasm.get('function_calls'))} conf={wasm.get('confidence')}\n"
                f"  py  : {json.dumps(ref.get('function_calls'))} conf={ref.get('confidence')}"
            )
    print(f"{same}/{len(dump['cases'])} cases: identical calls from wasm and the Python package")


if __name__ == "__main__":
    main(sys.argv[1])
