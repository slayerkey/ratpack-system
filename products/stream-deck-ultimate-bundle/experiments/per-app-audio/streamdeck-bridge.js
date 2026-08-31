"use strict";
const { ACTION_UUID } = require("./action-spec.js");

function compactKeyTitle(visual = {}) {
  const status = String(visual.status || "");
  const value = String(visual.value || "");
  if (status === "unavailable") return "AUDIO\nOFF";
  if (status === "unconfigured") return "SET\nAPP";
  const rawTitle = String(visual.title || "APP").toUpperCase().replace(/\s+/g, " ").trim();
  const title = rawTitle.length > 9 ? `${rawTitle.slice(0, 8)}…` : rawTitle;
  const shortValue = value === "WAITING" ? "WAITING" : value.length > 9 ? `${value.slice(0, 8)}…` : value;
  return `${title}\n${shortValue}`;
}

function createProtocolRenderer(send) {
  if (typeof send !== "function") throw new Error("Protocol renderer requires send");
  return async (context, view = {}) => {
    if (view.controller === "Encoder" && view.feedback) {
      send({ event: "setFeedback", context, payload: view.feedback });
      return;
    }
    send({
      event: "setTitle",
      context,
      payload: { title: compactKeyTitle(view.visual), target: 0 }
    });
  };
}

class AppAudioActionBridge {
  constructor(options = {}) {
    if (!options.runtime) throw new Error("AppAudioActionBridge requires runtime");
    this.runtime = options.runtime;
    this.actionUUID = options.actionUUID || ACTION_UUID;
  }

  accepts(message = {}) {
    return String(message.action || "") === this.actionUUID;
  }

  async handle(message = {}) {
    if (!this.accepts(message)) return { handled: false, result: null };
    return { handled: true, result: await this.runtime.handle(message) };
  }
}

module.exports = { compactKeyTitle, createProtocolRenderer, AppAudioActionBridge };
