#!/usr/bin/env python3
"""Compatibility entry point for the canonical World showcase generator.

Writes world.json, never the obsolete worldScenario.json duplicate.
"""
import pathlib
import subprocess

subprocess.run(
    ['node', '--import', 'tsx', 'scripts/generateWorldScenario.ts'],
    cwd=pathlib.Path(__file__).resolve().parent.parent,
    check=True,
)
