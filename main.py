# -*- coding: utf-8 -*-
"""Простой веб-сервер: онлайн-редактор Python + терминал.

Запуск:
    python main.py

Потом открой в браузере: http://127.0.0.1:5000
"""
import os
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import time

from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# Лимиты безопасности (можно менять)
MAX_CODE_CHARS = 100_000
EXEC_TIMEOUT = 10          # секунд на выполнение кода
TERMINAL_TIMEOUT = 10      # секунд на команду терминала
MAX_OUTPUT_CHARS = 50_000


def _run_in_isolated(code, timeout=EXEC_TIMEOUT):
    """Запускает код в отдельном процессе с временной рабочей папкой."""
    workdir = tempfile.mkdtemp(prefix="pyweb_")
    try:
        proc = subprocess.Popen(
            [sys.executable, "-u", "-c", code],
            cwd=workdir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

        try:
            stdout, stderr = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout, stderr = proc.communicate()
            return {
                "ok": False,
                "output": stdout,
                "error": "Превышен лимит времени выполнения ({} сек)".format(timeout),
                "timed_out": True,
            }

        return {
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "output": _truncate(stdout),
            "error": _truncate(stderr),
            "timed_out": False,
        }
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _truncate(text):
    if len(text) > MAX_OUTPUT_CHARS:
        return text[:MAX_OUTPUT_CHARS] + "\n...[вывод обрезан]..."
    return text


def _run_terminal(cmd, timeout=TERMINAL_TIMEOUT):
    """Выполняет shell-команду и возвращает её вывод."""
    proc = subprocess.Popen(
        cmd,
        cwd=os.path.expanduser("~"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        errors="replace",
        shell=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    try:
        stdout, stderr = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout, stderr = proc.communicate()
        return {
            "ok": False,
            "output": stdout,
            "error": "Превышен лимит времени команды ({} сек)".format(timeout),
            "timed_out": True,
        }
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "output": _truncate(stdout),
        "error": _truncate(stderr),
        "timed_out": False,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/run", methods=["POST"])
def api_run():
    data = request.get_json(silent=True) or {}
    code = data.get("code", "")
    if not isinstance(code, str):
        return jsonify({"ok": False, "error": "Некорректный запрос"}), 400
    if len(code) > MAX_CODE_CHARS:
        return jsonify({"ok": False, "error": "Код слишком большой"}), 400
    result = _run_in_isolated(code)
    return jsonify(result)


@app.route("/api/terminal", methods=["POST"])
def api_terminal():
    data = request.get_json(silent=True) or {}
    cmd = data.get("command", "")
    if not isinstance(cmd, str) or not cmd.strip():
        return jsonify({"ok": False, "error": "Пустая команда"}), 400
    if len(cmd) > 5000:
        return jsonify({"ok": False, "error": "Команда слишком длинная"}), 400
    result = _run_terminal(cmd)
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)