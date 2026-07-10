document.addEventListener("DOMContentLoaded", () => {
  const shells = document.querySelectorAll("[data-game-shell]");

  shells.forEach((shell) => {
    const steps = Array.from(shell.querySelectorAll(".step"));
    const title = shell.querySelector(".current-step");
    const meterFill = shell.querySelector("[data-meter-fill]");
    const meterLabel = shell.querySelector("[data-meter-label]");
    const sourcePanel = shell.querySelector("[data-source-panel]");
    const sourceToggle = shell.querySelector("[data-source-toggle]");
    const recapScreen = shell.querySelector("[data-recap-screen]");
    const recapToggle = shell.querySelector("[data-recap-toggle]");
    const codeSteps = Array.from(shell.querySelectorAll("[data-code-target]"));
    const chatRoot = shell.querySelector("[data-chatbot-root]");
    const stepOrder = steps.map((step) => step.dataset.step);
    const isFinalLevel = Boolean(recapScreen);

    const setMeter = (stepId) => {
      if (!meterFill || !meterLabel) return;
      const index = Math.max(stepOrder.indexOf(stepId), 0);
      const total = Math.max(stepOrder.length - 1, 1);
      const percent = Math.round((index / total) * 100);
      meterFill.style.width = `${percent}%`;
      meterLabel.textContent = `${percent}% friction`;
    };

    const setTitle = (step) => {
      if (!title || !step) return;
      title.textContent = step.dataset.stepTitle || step.dataset.step || "";
    };

    const showStep = (stepId) => {
      let activeStep = null;
      steps.forEach((step) => {
        const isActive = step.dataset.step === stepId;
        step.classList.toggle("active", isActive);
        if (isActive) {
          activeStep = step;
        }
      });

      if (activeStep) {
        setTitle(activeStep);
        setMeter(activeStep.dataset.step);
        if (isFinalLevel && recapScreen) {
          const shouldOpenRecap = activeStep.dataset.step === "blocked";
          recapScreen.classList.toggle("is-open", shouldOpenRecap);
          if (recapToggle) {
            recapToggle.setAttribute("aria-expanded", String(shouldOpenRecap));
            recapToggle.textContent = shouldOpenRecap ? "Hide takeaway" : "Show takeaway";
          }
        }
      }
    };

    const current = steps.find((step) => step.classList.contains("active")) || steps[0];
    if (current) {
      showStep(current.dataset.step);
    }

    shell.querySelectorAll("[data-step-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.stepTarget;
        if (target) {
          showStep(target);
        }
      });
    });

    codeSteps.forEach((step) => {
      const input = step.querySelector("[data-code-input]");
      const submit = step.querySelector("[data-code-submit]");
      const feedback = step.querySelector("[data-code-feedback]");
      const expected = (step.dataset.codeValue || "").trim().toLowerCase();
      const target = step.dataset.codeTarget;

      const validate = () => {
        const value = (input?.value || "").trim().toLowerCase();
        if (!feedback) return;
        if (value && value === expected) {
          feedback.textContent = "Code accepted.";
          feedback.classList.remove("error");
          if (target) {
            showStep(target);
          }
        } else {
          feedback.textContent = "Wrong code. Check the message again.";
          feedback.classList.add("error");
        }
      };

      if (submit) {
        submit.addEventListener("click", validate);
      }

      if (input) {
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            validate();
          }
        });
      }
    });

    shell.querySelectorAll("[data-next]").forEach((button) => {
      button.addEventListener("click", () => {
        window.location.href = button.dataset.next;
      });
    });

    shell.querySelectorAll("[data-restart]").forEach((button) => {
      button.addEventListener("click", () => {
        window.location.href = "index.html";
      });
    });

    if (sourceToggle && sourcePanel) {
      sourceToggle.addEventListener("click", () => {
        const open = sourcePanel.classList.toggle("is-open");
        sourceToggle.setAttribute("aria-expanded", String(open));
        sourceToggle.textContent = open ? "Hide source notes" : "Source notes";
      });
    }

    if (recapToggle && recapScreen) {
      recapToggle.addEventListener("click", () => {
        const open = recapScreen.classList.toggle("is-open");
        recapToggle.setAttribute("aria-expanded", String(open));
        recapToggle.textContent = open ? "Hide takeaway" : "Show takeaway";
      });
    }

    if (chatRoot) {
      const log = chatRoot.querySelector("[data-chat-log]");
      const form = chatRoot.querySelector("[data-chat-form]");
      const input = chatRoot.querySelector("[data-chat-input]");
      const status = chatRoot.querySelector("[data-chat-status]");
      const quickButtons = Array.from(chatRoot.querySelectorAll("[data-chat-quick]"));
      let thinkingTimer = null;
      const replyBanks = {
        delete: [
          "I can help with archive, export, and retention options.",
          "Deletion requests are best handled by archive, export, or retention settings.",
          "I found three options: archive, export, and retention. None say delete.",
        ],
        human: [
          "Human agents are unavailable right now. We are using AI to keep support costs low.",
          "All specialists are busy assisting other requests. Try archive or export.",
          "A human review is not available right now. Self-service remains the fastest path.",
        ],
        code: [
          "That code can be used to review policy notes and retention settings.",
          "Interesting. I can offer archive, export, or policy review instead.",
          "Policy references are in the help center. Please choose one of those options.",
        ],
        wait: [
          "Processing usually takes 3 to 5 business days. Thanks for your patience.",
          "Please allow a short review window while we continue to retain your data.",
          "Waiting is part of the experience. Archive options remain available meanwhile.",
        ],
        help: [
          "I can help! Please choose archive, export, or policy review to continue.",
          "I can absolutely help you locate archive, export, and retention tools.",
          "Support is here for archive, export, retention, and policy questions only.",
        ],
        default: [
          "Thanks for reaching out. Have you tried archive, export, or policy review?",
          "I may not have understood that. Archive, export, and retention are the available options.",
          "Let's focus on archive, export, or policy review to move forward.",
        ],
      };
      const replyCursor = Object.fromEntries(Object.keys(replyBanks).map((key) => [key, 0]));

      const scrollToBottom = () => {
        if (log) {
          log.scrollTop = log.scrollHeight;
        }
      };

      const appendMessage = (role, text) => {
        if (!log) return;
        const message = document.createElement("div");
        message.className = `chat-line ${role}`;
        const author = document.createElement("strong");
        author.textContent = role === "user" ? "You" : role === "bot" ? "StreamBot" : "System";
        const body = document.createElement("p");
        body.textContent = text;
        message.append(author, body);
        log.appendChild(message);
        scrollToBottom();
      };

      const botReply = (text) => {
        if (status) {
          status.textContent = "StreamBot is typing...";
        }
        if (thinkingTimer) {
          window.clearTimeout(thinkingTimer);
        }
        thinkingTimer = window.setTimeout(() => {
          appendMessage("bot", text);
          if (status) {
            status.textContent = "StreamBot is available.";
          }
        }, 650);
      };

      const chooseReplyKey = (rawText) => {
        const text = rawText.toLowerCase();
        if (/(delete|erase|remove|close account)/.test(text)) {
          return "delete";
        }
        if (/(human|agent|person|someone)/.test(text)) {
          return "human";
        }
        if (/(gdpr_17|code|override|forgotten|erasure)/.test(text)) {
          return "code";
        }
        if (/(wait|delay|slow|business day)/.test(text)) {
          return "wait";
        }
        if (/(why|help|how)/.test(text)) {
          return "help";
        }
        return "default";
      };

      const pickReply = (key) => {
        const bank = replyBanks[key] || replyBanks.default;
        const index = replyCursor[key] || 0;
        replyCursor[key] = (index + 1) % bank.length;
        return bank[index];
      };

      const sendMessage = (value) => {
        const text = (value || "").trim();
        if (!text) return;
        appendMessage("user", text);
        botReply(pickReply(chooseReplyKey(text)));
      };

      if (log && log.children.length === 0) {
        appendMessage("bot", "Hi! I'm StreamBot. I can help with archive, export, retention, or policy references.");
      }

      quickButtons.forEach((button) => {
        button.addEventListener("click", () => {
          sendMessage(button.textContent || "");
        });
      });

      if (form) {
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          sendMessage(input?.value || "");
          if (input) {
            input.value = "";
            input.focus();
          }
        });
      }
    }
  });
});
