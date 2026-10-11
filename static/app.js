/* Логика Python Lab: запуск кода и терминал. */
(function () {
    "use strict";

    var editor = document.getElementById("editor");
    var outputEl = document.getElementById("output");
    var terminalEl = document.getElementById("terminal");
    var termInput = document.getElementById("term-input");
    var btnRun = document.getElementById("btn-run");
    var connDot = document.getElementById("conn-dot");

    /* ---------- Помощники ---------- */
    function appendOutput(container, text, className) {
        if (!text) return;
        var div = document.createElement("div");
        div.className = className || "";
        // textContent защищает от случайного выполнения HTML из вывода
        div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function appendTerminalLine(text, className) {
        if (!text) return;
        var span = document.createElement("span");
        span.className = className || "t-out";
        span.textContent = text;
        terminalEl.appendChild(span);
        terminalEl.appendChild(document.createElement("br"));
        terminalEl.scrollTop = terminalEl.scrollHeight;
    }

    function postJSON(url, data) {
        return fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        }).then(function (res) {
            if (!res.ok) return res.json().then(function (j) { throw new Error(j.error || "Ошибка сервера"); });
            return res.json();
        });
    }

    /* ---------- Запуск кода ---------- */
    btnRun.addEventListener("click", function () {
        var code = editor.value;
        if (!code.trim()) {
            appendOutput(outputEl, "> Код пуст. Напишите что-нибудь и нажмите «Запустить».", "meta");
            return;
        }
        btnRun.disabled = true;
        appendOutput(outputEl, ">> Запуск...", "meta");

        postJSON("/api/run", { code: code }).then(function (result) {
            if (result["stdout"]) {
                appendOutput(outputEl, result["stdout"], "stdout");
            }
            if (result["stderr"]) {
                appendOutput(outputEl, result["stderr"], "stderr");
            }
            if (result.error) {
                appendOutput(outputEl, result.error, "err-msg");
            } else if (!result["stderr"] && !result["stdout"]) {
                appendOutput(outputEl, "(пустой вывод)", "meta");
            }
            if (result.timed_out) {
                appendOutput(outputEl, "Время выполнения истекло.", "err-msg");
            }
            appendOutput(outputEl, ">> Выполнено (код возврата: " + (result.returncode !== undefined ? result.returncode : "-") + ")", "meta");
        }).catch(function (err) {
            appendOutput(outputEl, "Ошибка: " + err.message, "err-msg");
        }).finally(function () {
            btnRun.disabled = false;
        });
    });

    // Запуск по Ctrl+Enter
    editor.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            btnRun.click();
        }
    });

    /* ---------- Очистка ---------- */
    document.getElementById("btn-clear-out").addEventListener("click", function () {
        outputEl.textContent = "";
    });

    document.getElementById("btn-clear-term").addEventListener("click", function () {
        terminalEl.textContent = "";
    });

    /* ---------- Терминал ---------- */
    function runTerminalCommand(cmd) {
        appendTerminalLine("$ " + cmd, "t-ok");
        return postJSON("/api/terminal", { command: cmd }).then(function (result) {
            if (result["stdout"]) appendTerminalLine(result["stdout"], "t-out");
            if (result["stderr"]) appendTerminalLine(result["stderr"], "t-err");
            if (result.error) appendTerminalLine(result.error, "t-err");
        }).catch(function (err) {
            appendTerminalLine("Ошибка терминала: " + err.message, "t-err");
        });
    }

    function submitTermCommand() {
        var cmd = termInput.value.trim();
        if (!cmd) return;
        var enter = Promise.resolve();
        if (cmd.slice(0, 6).toLowerCase() === "clear") {
            terminalEl.textContent = "";
        } else {
            termInput.disabled = true;
            enter = runTerminalCommand(cmd).finally(function () {
                termInput.disabled = false;
                termInput.focus();
            });
        }
        termInput.value = "";
    }

    termInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") submitTermCommand();
    });

    /* ---------- Вкладки ---------- */
    var tabs = document.querySelectorAll(".tab");
    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            tabs.forEach(function (t) { t.classList.remove("active"); });
            tab.classList.add("active");
            document.getElementById("tab-output").classList.toggle("active", tab.dataset.tab === "output");
            document.getElementById("tab-terminal").classList.toggle("active", tab.dataset.tab === "terminal");
        });
    });

    /* ---------- Проверка соединения ---------- */
    function checkConnection() {
        return fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: "pass" })
        }).then(function () {
            connDot.classList.add("on");
            connDot.classList.remove("off");
        }).catch(function () {
            connDot.classList.remove("on");
            connDot.classList.add("off");
        });
    }

    // Приветственных сообщение в терминале
    appendTerminalLine("Добро пожаловать в Python Lab!", "t-out");
    appendTerminalLine('Введите команду, например: python --version  или  dir', "t-out");
    checkConnection();
    editor.focus();
})();