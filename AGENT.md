# Reglas de Desarrollo y Flujo de Trabajo (AGENT.md)

## 1. Flujo de Trabajo y Despliegues (Staging primero)
- **Staging es el único destino inicial**: Todo feature, refactor, ajuste visual o corrección de bugs debe implementarse, compilarse y desplegarse **primero y únicamente en la rama `staging`** (`https://staging.giveo.net`).
- **Confirmación Obligatoria antes de Producción**: **NUNCA** hacer push ni merge a la rama `main` (Producción / `https://giveo.net`) de forma automática.
- **Paso a Producción**: Una vez desplegado y verificado en Staging, se le debe pedir **confirmación explícita** al usuario. Solo cuando el usuario confirme y apruebe los cambios en Staging, se hace el push a `main`.

## 2. Cambios en Base de Datos y Migraciones Drizzle
- **Generación de Migración Obligatoria**: Por cada cambio realizado en el esquema de base de datos (`src/lib/server/db/schema.ts`), es **obligatorio** generar formalmente la migración con Drizzle ejecutando:
  ```bash
  npm run db:generate
  # o: npx drizzle-kit generate
  ```
- **Integridad de Snapshots**: Esto asegura que se generen tanto el archivo `.sql` como el snapshot correspondiente en `drizzle/meta/` (`_journal.json` y `XXXX_snapshot.json`). No crear migraciones manuales sin snapshot en `meta/`, ya que el migrador de Drizzle en tiempo de ejecución requiere que el diario y los snapshots coincidan.
- **Salvaguardas DDL**: Usar cláusulas defensivas como `IF NOT EXISTS` en los archivos SQL y mantener las salvaguardas directas en `src/lib/server/db/migrate.ts` para garantizar arranque sin caídas.

## 3. Calidad de Código y Verificación
- Antes de commitear y pushear a staging, ejecutar siempre:
  ```bash
  npm run check
  npm run build
  ```
