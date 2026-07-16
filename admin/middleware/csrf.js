import crypto from "crypto";

function safeCompare(valueA, valueB) {
  const bufferA = Buffer.from(
    String(valueA || "")
  );

  const bufferB = Buffer.from(
    String(valueB || "")
  );

  return (
    bufferA.length === bufferB.length &&
    crypto.timingSafeEqual(
      bufferA,
      bufferB
    )
  );
}

export function getCsrfToken(req) {
  if (!req.session) {
    throw new Error(
      "La sesión no está disponible"
    );
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken =
      crypto.randomBytes(32).toString("hex");
  }

  return req.session.csrfToken;
}

export function verifyCsrfToken(
  req,
  res,
  next
) {
  const expectedToken =
    req.session?.csrfToken || "";

  const receivedToken =
    req.body?._csrf ||
    req.get("X-CSRF-Token") ||
    "";

  if (
    !expectedToken ||
    !receivedToken ||
    !safeCompare(
      expectedToken,
      receivedToken
    )
  ) {
    if (req.accepts("html")) {
      return res.status(403).send(
        "La solicitud ha caducado o no es válida."
      );
    }

    return res.status(403).json({
      ok: false,
      error: "Token CSRF no válido"
    });
  }

  next();
}
