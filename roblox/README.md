# 🎮 Integración de Roblox con el Sistema de Staff (Discord + Railway)

Esta carpeta contiene los scripts en **Luau** para conectar tu juego de Roblox con el bot de Discord y la base de datos PostgreSQL alojados en Railway.

---

## 📋 Requisitos Previos en Roblox Studio

### 1. Habilitar solicitudes HTTP (`HttpService`)
Por seguridad, Roblox Studio tiene deshabilitadas las peticiones externas de forma predeterminada:
1. Abre tu juego en **Roblox Studio**.
2. En la pestaña superior, ve a **Home (Inicio)** o **Model (Modelo)** y haz clic en **Game Settings (Configuración del juego)**.
3. Si el juego no está publicado, publícalo primero.
4. En el panel izquierdo de Game Settings, selecciona **Security (Seguridad)**.
5. Activa la opción **Allow HTTP Requests (Permitir solicitudes HTTP)**.
6. Haz clic en **Save (Guardar)**.

---

## 🛠️ Instalación de los Scripts

### 2. Script de Servidor (`StaffService.server.lua`)
1. En la ventana **Explorer (Explorador)** de Roblox Studio, busca la carpeta **ServerScriptService**.
2. Haz clic derecho sobre `ServerScriptService` -> **Insert Object** -> **Script**.
3. Renombra el script a `StaffService`.
4. Abre `StaffService` y pega el código completo de `roblox/StaffService.server.lua`.
5. **Configura las variables al inicio del script:**
   - `API_BASE_URL`: Coloca el dominio HTTPS público de tu servicio en Railway (ejemplo: `https://mi-bot-staff.up.railway.app`). **No agregues una barra diagonal al final.**
   - `ROBLOX_API_KEY`: Pega la misma clave secreta definida en la variable de entorno `ROBLOX_API_KEY` en Railway (mínimo 32 caracteres).

> **Nota:** El script crea automáticamente la carpeta `StaffRemotes` y los `RemoteEvents` necesarios (`StaffLinkEvent` y `StaffLinkResultEvent`) dentro de `ReplicatedStorage` si aún no existen.

### 3. Script de Cliente / Interfaz (`LinkClient.client.lua`)
1. En el **Explorer**, busca la carpeta **StarterPlayer** -> **StarterPlayerScripts** (o dentro de una `ScreenGui` en `StarterGui`).
2. Haz clic derecho -> **Insert Object** -> **LocalScript**.
3. Renombra el archivo a `LinkClient`.
4. Abre `LinkClient` y pega el contenido de `roblox/LinkClient.client.lua`.
5. Este script incluye automáticamente una interfaz gráfica limpia y moderna con un botón flotante **"🔗 Vincular Discord"** y un cuadro modal emergente con validación automática y mensajes en tiempo real.

---

## 🔄 Flujo de Trabajo en Juego y Discord

1. **Vincular cuenta:**
   - El miembro del staff escribe `/vincular` en Discord.
   - Recibe un mensaje efímero con un código temporal (ejemplo: `A7K-9P2`).
   - En el juego de Roblox, hace clic en el botón flotante **"🔗 Vincular Discord"**, escribe el código y presiona **Confirmar Vinculación**.
   - El servidor de Roblox valida la solicitud con Railway de forma segura, usando el `UserId` real del jugador (evitando cualquier tipo de suplantación de identidad).

2. **Entrar en servicio:**
   - En el canal del panel de Discord, el staff presiona **🟢 Entrar en servicio**.
   - Si ya está jugando en Roblox, el contador de servicio arranca inmediatamente.
   - Si aún no entra, el bot le otorga un tiempo de gracia de 10 minutos para unirse al servidor.
   - Cada 25 segundos, el servidor de Roblox envía la lista de jugadores activos al endpoint `/api/roblox/presence`.

3. **Salir de servicio:**
   - El staff presiona **🔴 Salir** en el panel de Discord, o simplemente abandona el juego (tras el periodo de gracia de 2 minutos sin presencia, el reconciliador cerrará automáticamente la sesión).
   - El tiempo acumulado queda registrado de forma persistente en PostgreSQL.

---

## 🔒 Buenas Prácticas de Seguridad
- **Nunca expongas `ROBLOX_API_KEY` en un LocalScript:** La clave debe existir únicamente en el script del servidor (`ServerScriptService`).
- La verificación de vinculación utiliza el `player.UserId` obtenido del servidor en el evento `RemoteEvent.OnServerEvent`. El cliente nunca puede enviar un ID arbitrario.
