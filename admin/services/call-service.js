import crypto from "crypto";

import {
  addCallEvent,
  createCallAttempt,
  createOrUpdateCall,
  updateCallAttempt,
  updateCallError
} from "../../database.js";

import {
  addAuditEntry
} from "./auth-service.js";

export class CallServiceError extends Error {
  constructor({
    code,
    publicMessage,
    status = 400,
    internalMessage = ""
  }) {
    super(internalMessage || publicMessage);
    this.name = "CallServiceError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = status;
  }
}

function rawText(value, limit) {
  return String(value ?? "")
    .trim()
    .slice(0, limit);
}

function validateText({
  value,
  field,
  limit,
  required = false
}) {
  const text = String(value ?? "").trim();

  if (required && !text) {
    throw new CallServiceError({
      code: `missing-${field}`,
      publicMessage:
        `El campo ${field} es obligatorio`,
      status: 400
    });
  }

  if (text.length > limit) {
    throw new CallServiceError({
      code: `invalid-${field}`,
      publicMessage:
        `El campo ${field} supera la longitud permitida`,
      status: 400
    });
  }

  return text;
}

function audit({
  adminUser,
  action,
  detail,
  ip
}) {
  if (!adminUser?.id) {
    return;
  }

  addAuditEntry({
    userId: adminUser.id,
    username: adminUser.username,
    action,
    detail,
    ip
  });
}

export function createCallService({
  twilioClient,
  buildStreamTwiML,
  publicBaseUrl,
  fromNumber,
  allowedTestNumber,
  defaultModel,
  defaultVoice,
  companyName,
  allowedAgents = ["principal"],
  allowedVoices = [defaultVoice]
}) {
  const agentSet = new Set(
    allowedAgents.filter(Boolean)
  );

  const voiceSet = new Set(
    allowedVoices.filter(Boolean)
  );

  function options() {
    return {
      agents: [...agentSet],
      voices: [...voiceSet],
      defaultAgent:
        [...agentSet][0] || "principal",
      defaultVoice
    };
  }

  async function startOutboundCall({
    input = {},
    source,
    adminUser = null,
    ip = null
  }) {
    const requestId = crypto.randomUUID();

    const attempt = {
      requestId,
      source,
      requestedNumber:
        rawText(input.telefono, 32),
      client: rawText(input.client, 150),
      agent:
        rawText(
          input.agent || options().defaultAgent,
          80
        ),
      voice:
        rawText(
          input.voice || defaultVoice,
          80
        ),
      campaign:
        rawText(input.campaign, 150),
      notes: rawText(input.notes, 1000),
      adminUserId: adminUser?.id || null,
      adminUsername:
        adminUser?.username || null,
      status: "received"
    };

    createCallAttempt(attempt);

    try {
      const telefono = validateText({
        value: input.telefono,
        field: "telefono",
        limit: 32,
        required: true
      });

      const client = validateText({
        value: input.client,
        field: "client",
        limit: 150
      });

      const agent = validateText({
        value:
          input.agent || options().defaultAgent,
        field: "agent",
        limit: 80,
        required: true
      });

      const voice = validateText({
        value: input.voice || defaultVoice,
        field: "voice",
        limit: 80,
        required: true
      });

      const campaign = validateText({
        value: input.campaign,
        field: "campaign",
        limit: 150
      });

      const notes = validateText({
        value: input.notes,
        field: "notes",
        limit: 1000
      });

      if (telefono !== allowedTestNumber) {
        throw new CallServiceError({
          code: "number-not-authorized",
          publicMessage:
            "El número no está autorizado para las pruebas",
          status: 403
        });
      }

      if (!agentSet.has(agent)) {
        throw new CallServiceError({
          code: "agent-not-authorized",
          publicMessage:
            "El agente IA seleccionado no está disponible",
          status: 400
        });
      }

      if (!voiceSet.has(voice)) {
        throw new CallServiceError({
          code: "voice-not-authorized",
          publicMessage:
            "La voz seleccionada no está disponible",
          status: 400
        });
      }

      updateCallAttempt({
        requestId,
        status: "validated"
      });

      const call = await twilioClient.calls.create({
        to: telefono,
        from: fromNumber,
        twiml: buildStreamTwiML(),
        statusCallback:
          `${publicBaseUrl}/twilio/status`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: [
          "initiated",
          "ringing",
          "answered",
          "completed"
        ]
      });

      createOrUpdateCall({
        callSid: call.sid,
        requestId,
        direction: "outbound",
        fromNumber,
        toNumber: telefono,
        status: call.status || "queued",
        model: defaultModel,
        voice,
        companyName,
        client: client || null,
        agent,
        campaign: campaign || null,
        notes: notes || null,
        adminUserId: adminUser?.id || null,
        adminUsername:
          adminUser?.username || null
      });

      addCallEvent({
        callSid: call.sid,
        eventType: "call-created",
        eventData: {
          requestId,
          source,
          adminUserId: adminUser?.id || null,
          adminUsername:
            adminUser?.username || null,
          client: client || null,
          agent,
          voice,
          campaign: campaign || null,
          notes: notes || null,
          status: call.status || "queued"
        }
      });

      updateCallAttempt({
        requestId,
        callSid: call.sid,
        status: call.status || "queued"
      });

      audit({
        adminUser,
        action: "admin-call-started",
        detail: {
          requestId,
          callSid: call.sid,
          requestedNumber: telefono,
          client: client || null,
          agent,
          voice,
          campaign: campaign || null
        },
        ip
      });

      return {
        requestId,
        callSid: call.sid,
        status: call.status || "queued"
      };
    } catch (error) {
      const serviceError =
        error instanceof CallServiceError
          ? error
          : new CallServiceError({
              code: "provider-error",
              publicMessage:
                "No se pudo iniciar la llamada",
              status: 502,
              internalMessage:
                error?.message ||
                "Error desconocido de Twilio"
            });

      updateCallAttempt({
        requestId,
        status: "failed",
        errorCode: serviceError.code,
        errorMessage: serviceError.message
      });

      if (error?.callSid) {
        updateCallError({
          callSid: error.callSid,
          errorMessage: serviceError.message
        });
      }

      audit({
        adminUser,
        action:
          serviceError.code ===
          "number-not-authorized"
            ? "admin-call-rejected"
            : "admin-call-error",
        detail: {
          requestId,
          requestedNumber:
            attempt.requestedNumber,
          code: serviceError.code
        },
        ip
      });

      throw serviceError;
    }
  }

  return {
    options,
    startOutboundCall
  };
}
