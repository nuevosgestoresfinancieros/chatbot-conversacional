# Reglas para Codex

- Trabajar solo en `feature/panel-premium`.
- No modificar `main`.
- No tocar Moodle ni otros proyectos.
- No iniciar nginx.
- No usar `sudo` sin autorización.
- No reiniciar Apache.
- No mostrar secretos de `.env`.
- Crear backups antes de cambios importantes.
- No borrar SQLite ni backups.
- Validar con `node --check`.
- Reiniciar solo `agente-telefonico-ia`.
- No hacer commit o push sin revisión.

# Rutina cada vez que vuelvas

Abre Codex en:

```text
/var/www/chatbot-conversacional.cibermedida.es
```

Escribe:

> Lee ESTADO_PROYECTO.md e INSTRUCCIONES_CODEX.md.
> Comprueba el estado actual del repositorio y dime cuál es el siguiente paso.
> No modifiques nada todavía.

# Al terminar cada jornada

Pide a Codex:

> Actualiza ESTADO_PROYECTO.md con:
> - cambios realizados;
> - pruebas superadas;
> - errores pendientes;
> - último commit;
> - siguiente tarea recomendada.

No incluyas secretos ni contraseñas.

# Nombre recomendado de la conversación

`Chatbot Cibermedida · Panel Premium · Desarrollo VPS`
