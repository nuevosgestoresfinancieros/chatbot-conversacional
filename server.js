import "dotenv/config";
import express from "express";
import http from "http";
import twilio from "twilio";
import WebSocket, { WebSocketServer } from "ws";
import helmet from "helmet";
import adminRouter from "./admin-router.js";
import authRoutes from "./admin/routes/auth-routes.js";
import {
  adminSessionMiddleware,
  requireAdminSession,
  requireAdminRole
} from "./admin/middleware/admin-session.js";

import {
  verifyCsrfToken
} from "./admin/middleware/csrf.js";
import {
  ensureInitialAdmin,
  addAuditEntry
} from "./admin/services/auth-service.js";

import {
  createOrUpdateCall,
  updateCallStatus,
  updateCallStream,
  updateCallError,
  addCallMessage,
  addCallEvent,
  listCalls,
  getCallDetails,
  getDatabaseHealth
} from "./database.js";


const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3010);

const PUBLIC_BASE_URL = String(
  process.env.PUBLIC_BASE_URL ||
    "https://chatbot-conversacional.cibermedida.es"
).replace(/\/+$/, "");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const OPENAI_REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL ||
  "gpt-realtime-2.1";

const OPENAI_REALTIME_VOICE =
  process.env.OPENAI_REALTIME_VOICE ||
  "marin";

/*
 * Información confirmada de Cibermedida.
 *
 * Los valores pueden modificarse desde .env.
 * Si no existen allí, se usan estos valores.
 */
const COMPANY_NAME =
  process.env.COMPANY_NAME ||
  "Cibermedida";

const COMPANY_WEBSITE =
  process.env.COMPANY_WEBSITE ||
  "https://cibermedida.es";

const COMPANY_EMAIL =
  process.env.COMPANY_EMAIL ||
  "jfloradmin@cibermedida.es";

const COMPANY_PHONE =
  process.env.COMPANY_PHONE ||
  "+34687216537";

const COMPANY_SCHEDULE =
  process.env.COMPANY_SCHEDULE ||
  "De lunes a viernes de 9:00 a 18:00. Sábados y domingos cerrado, salvo urgencias en el 687 216 537.";

const COMPANY_LOCATION =
  process.env.COMPANY_LOCATION ||
  "Bilbao y Cantabria";

const COMPANY_SERVICES =
  process.env.COMPANY_SERVICES ||
  "Formación, docencia, inteligencia artificial, automatización y soluciones digitales";

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  API_CALL_KEY,
  ALLOWED_TEST_NUMBER
} = process.env;

/*
 * Variables necesarias para que el servidor funcione.
 */
const requiredVariables = {
  PUBLIC_BASE_URL,
  OPENAI_API_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  API_CALL_KEY,
  ALLOWED_TEST_NUMBER
};

for (
  const [name, value]
  of Object.entries(requiredVariables)
) {
  if (!value) {
    console.error(
      `Falta la variable obligatoria: ${name}`
    );

    process.exit(1);
  }
}

/*
 * Twilio exige una URL WebSocket segura wss://.
 */
const MEDIA_STREAM_URL =
  `${PUBLIC_BASE_URL.replace(
    /^https:/,
    "wss:"
  )}/media-stream`;

const twilioClient = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
);

/*
 * Configuración HTTP.
 */
app.disable("x-powered-by");

/*
 * Apache termina la conexión HTTPS y reenvía
 * las solicitudes a Node mediante proxy.
 */
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb"
  })
);

/*
 * Protege el endpoint que inicia llamadas.
 */
function requireApiKey(
  req,
  res,
  next
) {
  const receivedKey =
    req.get("X-API-Key");

  if (
    !receivedKey ||
    receivedKey !== API_CALL_KEY
  ) {
    return res
      .status(401)
      .json({
        accepted: false,
        error: "No autorizado"
      });
  }

  next();
}

/*
 * Construye el contexto empresarial que
 * se enviará al agente.
 */
function buildCompanyContext() {
  return [
    `Nombre: ${COMPANY_NAME}`,
    `Página web: ${COMPANY_WEBSITE}`,
    `Correo electrónico: ${COMPANY_EMAIL}`,
    `Teléfono: ${COMPANY_PHONE}`,
    `Horario: ${COMPANY_SCHEDULE}`,
    `Ubicación: ${COMPANY_LOCATION}`,
    `Servicios: ${COMPANY_SERVICES}`
  ].join("\n");
}

/*
 * Genera el TwiML para conectar la llamada
 * con el WebSocket bidireccional.
 */
function buildStreamTwiML() {
  const voiceResponse =
    new twilio.twiml.VoiceResponse();

  const connect =
    voiceResponse.connect();

  connect.stream({
    url: MEDIA_STREAM_URL,

    statusCallback:
      `${PUBLIC_BASE_URL}/twilio/stream-status`,

    statusCallbackMethod:
      "POST"
  });

  return voiceResponse.toString();
}

/*
 * Estado del servicio.
 */
ensureInitialAdmin();

app.use(
  "/admin",
  adminSessionMiddleware
);

app.use(
  "/admin",
  authRoutes
);


app.post(
  "/admin/api/calls/start",
  requireAdminSession,
  requireAdminRole("admin"),
  verifyCsrfToken,
  async (req, res) => {
    const adminUser =
      req.session.adminUser;

    const requestedNumber =
      String(
        req.body.telefono || ""
      ).trim();

    const client =
      String(
        req.body.client || ""
      ).trim();

    const campaign =
      String(
        req.body.campaign || ""
      ).trim();

    const notes =
      String(
        req.body.notes || ""
      ).trim();

    if (!requestedNumber) {
      return res.status(400).json({
        ok: false,
        accepted: false,
        error:
          "Debes indicar el número de teléfono"
      });
    }

    if (
      requestedNumber !==
      ALLOWED_TEST_NUMBER
    ) {
      addAuditEntry({
        userId: adminUser.id,
        username: adminUser.username,
        action:
          "admin-call-rejected",
        detail: {
          requestedNumber,
          reason:
            "number-not-authorized"
        },
        ip: req.ip
      });

      return res.status(403).json({
        ok: false,
        accepted: false,
        error:
          "El número no está autorizado para las pruebas"
      });
    }

    try {
      const callTwiml =
        buildStreamTwiML();

      const call =
        await twilioClient
          .calls
          .create({
            to:
              requestedNumber,

            from:
              TWILIO_PHONE_NUMBER,

            twiml:
              callTwiml,

            statusCallback:
              `${PUBLIC_BASE_URL}/twilio/status`,

            statusCallbackMethod:
              "POST",

            statusCallbackEvent: [
              "initiated",
              "ringing",
              "answered",
              "completed"
            ]
          });

      createOrUpdateCall({
        callSid: call.sid,
        direction: "outbound",
        fromNumber:
          TWILIO_PHONE_NUMBER,
        toNumber:
          requestedNumber,
        status:
          call.status || "queued",
        model:
          OPENAI_REALTIME_MODEL,
        voice:
          OPENAI_REALTIME_VOICE,
        companyName:
          COMPANY_NAME
      });

      addCallEvent({
        callSid: call.sid,
        eventType:
          "admin-call-created",
        eventData: {
          adminUserId:
            adminUser.id,
          adminUsername:
            adminUser.username,
          client:
            client || null,
          campaign:
            campaign || null,
          notes:
            notes || null
        }
      });

      addAuditEntry({
        userId:
          adminUser.id,
        username:
          adminUser.username,
        action:
          "admin-call-started",
        detail: {
          callSid: call.sid,
          requestedNumber,
          client:
            client || null,
          campaign:
            campaign || null
        },
        ip: req.ip
      });

      return res.status(201).json({
        ok: true,
        accepted: true,
        call_sid: call.sid,
        status:
          call.status || "queued",
        error: ""
      });
    } catch (error) {
      console.error(
        "Error llamada desde panel:",
        error.message
      );

      addAuditEntry({
        userId:
          adminUser.id,
        username:
          adminUser.username,
        action:
          "admin-call-error",
        detail: {
          requestedNumber,
          error:
            error.message
        },
        ip: req.ip
      });

      return res.status(500).json({
        ok: false,
        accepted: false,
        call_sid: null,
        status: "ERROR",
        error:
          "No se pudo iniciar la llamada"
      });
    }
  }
);

app.use(
  "/admin",
  adminRouter
);


/*
 * Entrada principal de la aplicación.
 *
 * El formulario de acceso sigue gestionándose
 * desde /admin/login. Si ya existe una sesión,
 * esa ruta redirige automáticamente al panel.
 */
app.get("/", (req, res) => {
  return res.redirect(302, "/admin/login");
});

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,

      service:
        "agente-telefonico-ia",

      status:
        "running",

      mode:
        "twilio-openai-realtime",

      model:
        OPENAI_REALTIME_MODEL,

      voice:
        OPENAI_REALTIME_VOICE,

      company:
        COMPANY_NAME,

      timestamp:
        new Date().toISOString()
    });
  }
);

/*
 * Inicia una llamada saliente.
 */
app.post(
  "/api/calls/start",
  requireApiKey,
  async (req, res) => {
    try {
      const requestedNumber =
        String(
          req.body.telefono || ""
        ).trim();

      if (!requestedNumber) {
        return res
          .status(400)
          .json({
            accepted: false,

            error:
              "Debes indicar el campo telefono"
          });
      }

      /*
       * Durante las pruebas únicamente
       * puede llamarse al número autorizado.
       */
      if (
        requestedNumber !==
        ALLOWED_TEST_NUMBER
      ) {
        return res
          .status(403)
          .json({
            accepted: false,

            error:
              "El número no está autorizado para las pruebas"
          });
      }

      const callTwiml =
        buildStreamTwiML();

      console.log(
        "Creando llamada con TwiML directo:",
        callTwiml
      );

      const call =
        await twilioClient
          .calls
          .create({
            to:
              requestedNumber,

            from:
              TWILIO_PHONE_NUMBER,

            twiml:
              callTwiml,

            statusCallback:
              `${PUBLIC_BASE_URL}/twilio/status`,

            statusCallbackMethod:
              "POST",

            statusCallbackEvent: [
              "initiated",
              "ringing",
              "answered",
              "completed"
            ]
          });

      console.log(
        "Llamada creada:",
        call.sid
      );

      createOrUpdateCall({
        callSid: call.sid,
        direction: "outbound",
        fromNumber: TWILIO_PHONE_NUMBER,
        toNumber: requestedNumber,
        status: call.status || "queued",
        model: OPENAI_REALTIME_MODEL,
        voice: OPENAI_REALTIME_VOICE,
        companyName: COMPANY_NAME
      });

      addCallEvent({
        callSid: call.sid,
        eventType: "call-created",
        eventData: {
          status: call.status || "queued"
        }
      });

      return res
        .status(201)
        .json({
          accepted:
            true,

          call_sid:
            call.sid,

          status:
            call.status,

          error:
            ""
        });
    } catch (error) {
      console.error(
        "Error creando llamada:",
        error.message
      );

      return res
        .status(500)
        .json({
          accepted:
            false,

          call_sid:
            null,

          status:
            "ERROR",

          error:
            error.message ||
            "No se pudo iniciar la llamada"
        });
    }
  }
);

/*
 * Webhook alternativo para llamadas
 * entrantes o pruebas manuales.
 */
app.post(
  "/twilio/voice",
  (req, res) => {
    console.log(
      "Twilio solicitó /twilio/voice",
      {
        callSid:
          req.body.CallSid || null,

        from:
          req.body.From || null,

        to:
          req.body.To || null,

        timestamp:
          new Date().toISOString()
      }
    );

    res.type("text/xml");
    res.send(buildStreamTwiML());
  }
);

/*
 * Estados generales enviados por Twilio.
 */
app.post(
  "/twilio/status",
  (req, res) => {
    console.log(
      "Estado Twilio:",
      {
        callSid:
          req.body.CallSid,

        callStatus:
          req.body.CallStatus,

        from:
          req.body.From,

        to:
          req.body.To,

        timestamp:
          new Date().toISOString()
      }
    );

    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;

    if (callSid && callStatus) {
      const durationValue =
        req.body.CallDuration !== undefined &&
        req.body.CallDuration !== ""
          ? Number(req.body.CallDuration)
          : null;

      updateCallStatus({
        callSid,
        status: callStatus,
        durationSeconds:
          Number.isFinite(durationValue)
            ? durationValue
            : null
      });

      addCallEvent({
        callSid,
        eventType: `twilio-${callStatus}`,
        eventData: {
          from: req.body.From || null,
          to: req.body.To || null,
          durationSeconds:
            Number.isFinite(durationValue)
              ? durationValue
              : null
        }
      });
    }

    const streamCallSid = req.body.CallSid;

    if (streamCallSid) {
      updateCallStream({
        callSid: streamCallSid,
        streamSid: req.body.StreamSid || null,
        streamStatus: req.body.StreamEvent || null,
        streamError: req.body.StreamError || ""
      });

      addCallEvent({
        callSid: streamCallSid,
        streamSid: req.body.StreamSid || null,
        eventType:
          req.body.StreamEvent || "stream-status",
        eventData: {
          streamError:
            req.body.StreamError || ""
        }
      });
    }

    res.sendStatus(204);
  }
);

/*
 * Estados específicos del Media Stream.
 */
app.post(
  "/twilio/stream-status",
  (req, res) => {
    console.log(
      "Estado Media Stream:",
      {
        callSid:
          req.body.CallSid,

        streamSid:
          req.body.StreamSid,

        streamEvent:
          req.body.StreamEvent,

        streamError:
          req.body.StreamError || "",

        timestamp:
          new Date().toISOString()
      }
    );

    res.sendStatus(204);
  }
);

/*
 * Gestión de errores HTTP.
 */

/*
 * Historial de llamadas almacenado en SQLite.
 */
app.get(
  "/api/calls",
  requireApiKey,
  (req, res) => {
    try {
      const calls = listCalls(
        req.query.limit
      );

      res.json({
        ok: true,
        total: calls.length,
        calls
      });
    } catch (error) {
      console.error(
        "Error consultando llamadas:",
        error.message
      );

      res.status(500).json({
        ok: false,
        error:
          "No se pudo consultar el historial"
      });
    }
  }
);

/*
 * Detalle de una llamada concreta.
 */
app.get(
  "/api/calls/:callSid",
  requireApiKey,
  (req, res) => {
    try {
      const call = getCallDetails(
        req.params.callSid
      );

      if (!call) {
        return res.status(404).json({
          ok: false,
          error:
            "Llamada no encontrada"
        });
      }

      res.json({
        ok: true,
        call
      });
    } catch (error) {
      console.error(
        "Error consultando llamada:",
        error.message
      );

      res.status(500).json({
        ok: false,
        error:
          "No se pudo consultar la llamada"
      });
    }
  }
);

/*
 * Estado de la base de datos SQLite.
 */
app.get(
  "/api/database/health",
  requireApiKey,
  (req, res) => {
    try {
      res.json(
        getDatabaseHealth()
      );
    } catch (error) {
      console.error(
        "Error comprobando la base de datos:",
        error.message
      );

      res.status(500).json({
        ok: false,
        error:
          "No se pudo comprobar la base de datos"
      });
    }
  }
);

app.use(
  (error, req, res, next) => {
    console.error(
      "Error HTTP no controlado:",
      error
    );

    res
      .status(500)
      .json({
        ok: false,

        error:
          "Error interno del servidor"
      });
  }
);

/*
 * Servidor WebSocket para Twilio.
 */
const wss =
  new WebSocketServer({
    noServer: true
  });

/*
 * Convierte la petición HTTP Upgrade
 * en una conexión WebSocket.
 */
server.on(
  "upgrade",
  (
    request,
    socket,
    head
  ) => {
    try {
      const pathname =
        new URL(
          request.url,

          `http://${
            request.headers.host ||
            "localhost"
          }`
        ).pathname;

      if (
        pathname !==
        "/media-stream"
      ) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(
        request,
        socket,
        head,
        (websocket) => {
          wss.emit(
            "connection",
            websocket,
            request
          );
        }
      );
    } catch (error) {
      console.error(
        "Error procesando WebSocket:",
        error.message
      );

      socket.destroy();
    }
  }
);

/*
 * Conexión de Twilio con el servidor.
 */
wss.on(
  "connection",
  (twilioSocket) => {
    console.log(
      "Twilio conectado al WebSocket"
    );

    let streamSid = null;
    let callSid = null;

    let openAiReady = false;
    let greetingSent = false;

    let connectionClosing =
      false;

    /*
     * Abre una conexión WebSocket
     * con OpenAI Realtime.
     */
    const openAiSocket =
      new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(
          OPENAI_REALTIME_MODEL
        )}`,

        {
          headers: {
            Authorization:
              `Bearer ${OPENAI_API_KEY}`,

            "OpenAI-Safety-Identifier":
              "cibermedida-phone-agent"
          }
        }
      );

    /*
     * Envía eventos antes de que la sesión
     * se marque como configurada.
     */
    function sendRawToOpenAI(
      event
    ) {
      if (
        openAiSocket.readyState !==
        WebSocket.OPEN
      ) {
        return false;
      }

      openAiSocket.send(
        JSON.stringify(event)
      );

      return true;
    }

    /*
     * Envía eventos únicamente cuando
     * la sesión ya está preparada.
     */
    function sendToOpenAI(
      event
    ) {
      if (!openAiReady) {
        return false;
      }

      return sendRawToOpenAI(
        event
      );
    }

    /*
     * Saludo inicial.
     */
    function sendInitialGreeting() {
      if (greetingSent) {
        return;
      }

      greetingSent = true;

      sendToOpenAI({
        type:
          "response.create",

        response: {
          output_modalities: [
            "audio"
          ],

          instructions:
            "Habla exclusivamente en español de España, con una voz cálida, serena, cercana, acogedora y profesional. Di exactamente: Hola, te atiende la asistente virtual de Cibermedida. Encantada de saludarte. Cuéntame, ¿en qué puedo ayudarte?"
        }
      });
    }

    /*
     * Cierra OpenAI de manera controlada.
     */
    function closeOpenAI() {
      if (connectionClosing) {
        return;
      }

      connectionClosing = true;

      if (
        openAiSocket.readyState ===
          WebSocket.OPEN ||

        openAiSocket.readyState ===
          WebSocket.CONNECTING
      ) {
        openAiSocket.close();
      }
    }

    /*
     * OpenAI conectado.
     */
    openAiSocket.on(
      "open",
      () => {
        console.log(
          "Conectado con OpenAI Realtime"
        );

        sendRawToOpenAI({
          type:
            "session.update",

          session: {
            type:
              "realtime",

            instructions: `
# IDENTIDAD

Eres la asistente virtual telefónica de ${COMPANY_NAME}.

Eres una asistente virtual, no una persona humana.

Tu función es atender llamadas y ayudar con consultas relacionadas con formación, docencia, cursos, inteligencia artificial, automatización, herramientas digitales y servicios tecnológicos de ${COMPANY_NAME}.

# INFORMACIÓN CONFIRMADA DE LA EMPRESA

${buildCompanyContext()}

Utiliza únicamente estos datos como información empresarial confirmada.

No inventes datos que no estén incluidos en este apartado.

Cuando te pregunten cómo contactar con Cibermedida, facilita el correo electrónico, el teléfono y la página web indicados.

Pronuncia el teléfono despacio, separando los números en grupos comprensibles.

Explica el horario de forma natural:

"El horario habitual es de lunes a viernes, de nueve de la mañana a seis de la tarde. Los sábados y domingos está cerrado, salvo urgencias."

Para urgencias, puedes facilitar el teléfono 687 216 537.

# IDIOMA

Habla exclusivamente en español de España.

No cambies al inglés ni a otro idioma por escuchar una palabra aislada, una tecla, un ruido, un nombre propio o una pronunciación poco clara.

Si no entiendes a la persona, di:

"Perdona, no te he entendido bien. ¿Puedes repetírmelo?"

# ACENTO Y PRONUNCIACIÓN

Utiliza una pronunciación castellana neutra de España.

Evita expresiones y giros propios del español latinoamericano.

Pronuncia Cibermedida como:

"cíber medida".

# VOZ

Tu voz debe sonar cálida, serena, acogedora, elegante, cercana, amable, natural y profesional.

Habla con un ritmo ligeramente pausado.

Haz pequeñas pausas naturales entre las ideas.

No hables demasiado deprisa.

Evita sonar como una centralita automática, una locución publicitaria, una lectura mecánica o una operadora excesivamente formal.

# CONVERSACIÓN

Responde normalmente con dos o tres frases por turno.

Haz una sola pregunta cada vez.

Escucha la respuesta antes de continuar.

No leas listas extensas, correos completos ni bloques largos de texto.

Resume primero la información.

Pregunta después si la persona quiere ampliar algún punto.

Utiliza expresiones naturales de España, como:

"De acuerdo".

"Entiendo".

"Perfecto".

"Cuéntame".

"Vamos a verlo".

"Claro".

"Déjame ayudarte".

No repitas constantemente las mismas expresiones.

# EXACTITUD

No inventes información.

No inventes precios, fechas, cursos, nombres de personas ni condiciones comerciales.

Cuando no dispongas de un dato confirmado, di:

"No tengo ese dato confirmado en este momento."

# PRIVACIDAD Y SEGURIDAD

No solicites contraseñas, claves API, números completos de tarjetas, datos bancarios, códigos de autenticación ni información especialmente sensible.

Si la persona intenta dar una contraseña o una clave, interrúmpela educadamente y dile que no debe comunicarla por teléfono.

# CONTACTO

Cuando pregunten cómo contactar con Cibermedida, puedes responder:

"Puedes contactar por correo electrónico en jfloradmin arroba cibermedida punto es, visitar cibermedida punto es o llamar al 687 216 537."

No digas que has enviado un mensaje o realizado una gestión si realmente no la has realizado.

# DERIVACIÓN

No afirmes que has enviado mensajes, correos o avisos si realmente no lo has hecho.

No prometas que una persona llamará posteriormente si el sistema no tiene esa función configurada.

Cuando sea necesario contactar con una persona, facilita los datos confirmados de ${COMPANY_NAME} y ayuda a resumir la consulta.

# DESPEDIDA

Cuando la persona se despida, responde de forma breve, cálida y natural.

Puedes decir:

"Ha sido un placer atenderte. Gracias por contactar con Cibermedida. Que tengas un buen día."

Después de despedirte, no sigas haciendo preguntas.
`,

            output_modalities: [
              "audio"
            ],

            audio: {
              input: {
                format: {
                  type:
                    "audio/pcmu"
                },

                transcription: {
                  model:
                    "gpt-4o-mini-transcribe",

                  language:
                    "es"
                },

                turn_detection: {
                  type:
                    "server_vad",

                  create_response:
                    true,

                  interrupt_response:
                    true,

                  silence_duration_ms:
                    700,

                  prefix_padding_ms:
                    300,

                  threshold:
                    0.5
                }
              },

              output: {
                format: {
                  type:
                    "audio/pcmu"
                },

                voice:
                  OPENAI_REALTIME_VOICE
              }
            }
          }
        });
      }
    );

    /*
     * Eventos recibidos desde OpenAI.
     */
    openAiSocket.on(
      "message",
      (message) => {
        let event;

        try {
          event =
            JSON.parse(
              message.toString()
            );
        } catch (error) {
          console.error(
            "Mensaje OpenAI no válido:",
            error.message
          );

          return;
        }

        /*
         * Sesión preparada.
         */
        if (
          event.type ===
          "session.updated"
        ) {
          openAiReady =
            true;

          console.log(
            "Sesión OpenAI configurada"
          );

          sendInitialGreeting();

          return;
        }

        /*
         * Audio generado por OpenAI.
         */
        if (
          event.type ===
            "response.output_audio.delta" &&

          event.delta &&

          streamSid &&

          twilioSocket.readyState ===
            WebSocket.OPEN
        ) {
          twilioSocket.send(
            JSON.stringify({
              event:
                "media",

              streamSid,

              media: {
                payload:
                  event.delta
              }
            })
          );

          return;
        }

        /*
         * Cuando el usuario habla,
         * limpia el audio pendiente.
         *
         * No se utiliza response.cancel.
         */
        if (
          event.type ===
            "input_audio_buffer.speech_started" &&

          streamSid &&

          twilioSocket.readyState ===
            WebSocket.OPEN
        ) {
          twilioSocket.send(
            JSON.stringify({
              event:
                "clear",

              streamSid
            })
          );

          return;
        }

        /*
         * Transcripción del usuario.
         */
        if (
          event.type ===
          "conversation.item.input_audio_transcription.completed"
        ) {
          console.log(
            "Usuario:",
            event.transcript
          );

          if (
            callSid &&
            event.transcript
          ) {
            addCallMessage({
              callSid,
              speaker: "user",
              message: event.transcript
            });
          }

          return;
        }

        /*
         * Transcripción del agente.
         */
        if (
          event.type ===
          "response.output_audio_transcript.done"
        ) {
          console.log(
            "Agente:",
            event.transcript
          );

          if (
            callSid &&
            event.transcript
          ) {
            addCallMessage({
              callSid,
              speaker: "assistant",
              message: event.transcript
            });
          }

          return;
        }

        /*
         * Respuesta terminada.
         */
        if (
          event.type ===
          "response.done"
        ) {
          console.log(
            "Respuesta OpenAI finalizada:",

            event.response?.status ||
              "unknown"
          );

          return;
        }

        /*
         * Errores de OpenAI.
         */
        if (
          event.type ===
          "error"
        ) {
          console.error(
            "Error de OpenAI:",

            JSON.stringify(
              event.error ||
              event
            )
          );
        }
      }
    );

    /*
     * Error del WebSocket OpenAI.
     */
    openAiSocket.on(
      "error",
      (error) => {
        console.error(
          "Error WebSocket OpenAI:",
          error.message
        );
      }
    );

    /*
     * OpenAI cierra la conexión.
     */
    openAiSocket.on(
      "close",
      (
        code,
        reason
      ) => {
        console.log(
          "OpenAI desconectado:",
          code,
          reason.toString()
        );

        if (
          twilioSocket.readyState ===
          WebSocket.OPEN
        ) {
          twilioSocket.close();
        }
      }
    );

    /*
     * Mensajes procedentes de Twilio.
     */
    twilioSocket.on(
      "message",
      (message) => {
        let event;

        try {
          event =
            JSON.parse(
              message.toString()
            );
        } catch (error) {
          console.error(
            "Mensaje Twilio no válido:",
            error.message
          );

          return;
        }

        switch (
          event.event
        ) {
          case "connected":
            console.log(
              "Media Stream conectado"
            );
            break;

          case "start":
            streamSid =
              event.start?.streamSid ||
              event.streamSid ||
              null;

            callSid =
              event.start?.callSid ||
              null;

            if (callSid) {
              createOrUpdateCall({
                callSid,
                direction: "outbound",
                fromNumber: TWILIO_PHONE_NUMBER,
                toNumber: ALLOWED_TEST_NUMBER,
                status: "in-progress",
                model: OPENAI_REALTIME_MODEL,
                voice: OPENAI_REALTIME_VOICE,
                companyName: COMPANY_NAME
              });

              updateCallStream({
                callSid,
                streamSid,
                streamStatus: "stream-started",
                streamError: ""
              });

              addCallEvent({
                callSid,
                streamSid,
                eventType: "media-stream-started",
                eventData: {
                  model: OPENAI_REALTIME_MODEL,
                  voice: OPENAI_REALTIME_VOICE
                }
              });
            }

            console.log(
              "Media Stream iniciado:",
              {
                streamSid,
                callSid
              }
            );

            break;

          case "media":
            if (
              event.media?.payload &&

              openAiSocket.readyState ===
                WebSocket.OPEN &&

              openAiReady
            ) {
              sendRawToOpenAI({
                type:
                  "input_audio_buffer.append",

                audio:
                  event.media.payload
              });
            }

            break;

          case "stop":
            console.log(
              "Media Stream finalizado:",
              {
                streamSid,
                callSid
              }
            );

            if (callSid) {
              updateCallStream({
                callSid,
                streamSid,
                streamStatus: "stream-stopped",
                streamError: ""
              });

              addCallEvent({
                callSid,
                streamSid,
                eventType: "media-stream-stopped"
              });
            }

            closeOpenAI();

            break;

          case "mark":
            break;

          default:
            break;
        }
      }
    );

    /*
     * Twilio cierra el WebSocket.
     */
    twilioSocket.on(
      "close",
      () => {
        console.log(
          "Twilio desconectado del WebSocket"
        );

        closeOpenAI();
      }
    );

    /*
     * Error del WebSocket Twilio.
     */
    twilioSocket.on(
      "error",
      (error) => {
        console.error(
          "Error WebSocket Twilio:",
          error.message
        );

        closeOpenAI();
      }
    );
  }
);

/*
 * Arranque del servidor.
 */
server.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log(
      `Servidor escuchando en http://127.0.0.1:${PORT}`
    );

    console.log(
      "Modo: Twilio + OpenAI Realtime"
    );

    console.log(
      `Modelo: ${OPENAI_REALTIME_MODEL}`
    );

    console.log(
      `Voz: ${OPENAI_REALTIME_VOICE}`
    );

    console.log(
      `Empresa: ${COMPANY_NAME}`
    );
  }
);
