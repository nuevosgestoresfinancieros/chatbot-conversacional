# Estado actual

- Rama: `feature/panel-premium`
- Main: estable, no modificar
- VPS: `aula-cibermedida`
- Apache activo
- No iniciar nginx
- PM2: `agente-telefonico-ia`
- Puerto: `127.0.0.1:3010`
- Dominio: <https://chatbot-conversacional.cibermedida.es>

# Implementado

- Login seguro
- Sesiones SQLite
- CSRF
- Helmet
- Dashboard Premium
- Historial de llamadas
- Twilio
- OpenAI Realtime
- Auditoría básica

# Siguiente fase

1. Estabilizar dashboard.
2. Unificar lógica de llamadas.
3. Completar centro de llamadas.
4. Crear clientes y CRM.
5. Importación CSV/XLSX/JSON.
6. Make, RAG y estadísticas.

# Comprobaciones

```bash
git branch --show-current
git status --short
pm2 status agente-telefonico-ia
curl -sS http://127.0.0.1:3010/api/health
```
